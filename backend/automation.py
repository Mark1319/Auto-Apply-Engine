"""
Job automation engine using Playwright.
Handles LinkedIn, Indeed, Naukri, Internshala, Hirist, and Instahire.
Supports AI-powered per-job resume tailoring via Claude.
"""
import asyncio
import random
from typing import Optional
from playwright.async_api import async_playwright, Page, Browser
from resume_tailor import tailor_resume, cleanup_tailored_resume


class JobAutomator:
    def __init__(
        self,
        profile: dict,
        filters: dict,
        resume_path: str,
        tailor_enabled: bool = False,
        anthropic_api_key: str = "",
    ):
        self.profile = profile
        self.filters = filters
        self.resume_path = resume_path          # base resume (always kept)
        self.active_resume_path = resume_path   # swapped per-job when tailoring
        self.tailor_enabled = tailor_enabled
        self.anthropic_api_key = anthropic_api_key
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None

    async def _get_resume_for_job(self, job_description: str, title: str, company: str) -> str:
        """
        If tailoring is enabled, generate a tailored PDF for this specific job.
        Falls back to base resume on any error.
        """
        if not self.tailor_enabled or not self.anthropic_api_key or not job_description.strip():
            return self.resume_path

        # Clean up the previously generated tailored PDF
        if self.active_resume_path != self.resume_path:
            cleanup_tailored_resume(self.active_resume_path)

        print(f"🤖 Tailoring resume for: {title} @ {company}...")
        try:
            tailored_path, _ = await tailor_resume(
                base_resume_path=self.resume_path,
                job_description=job_description,
                profile=self.profile,
                api_key=self.anthropic_api_key,
            )
            self.active_resume_path = tailored_path
            print(f"✅ Tailored resume ready")
            return tailored_path
        except Exception as e:
            print(f"⚠️  Tailoring failed ({e}), using base resume")
            return self.resume_path

    async def _cleanup(self):
        """Close browser and remove any leftover tailored PDF."""
        if self.browser:
            await self.browser.close()
        if self.active_resume_path != self.resume_path:
            cleanup_tailored_resume(self.active_resume_path)

    async def _init_browser(self, headless: bool = False):
        """Launch Playwright browser with stealth settings."""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ]
        )
        context = await self.browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )
        self.page = await context.new_page()
        await self.page.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )

    async def _human_delay(self, min_ms=500, max_ms=2000):
        """Simulate human-like delays."""
        await asyncio.sleep(random.uniform(min_ms / 1000, max_ms / 1000))

    async def _type_slowly(self, selector: str, text: str):
        """Type text with human-like speed."""
        await self.page.click(selector)
        for char in text:
            await self.page.type(selector, char, delay=random.randint(50, 150))

    async def _scrape_jd(self, selectors: list[str]) -> str:
        """Try a list of CSS selectors to extract job description text."""
        for sel in selectors:
            try:
                el = await self.page.query_selector(sel)
                if el:
                    text = await el.inner_text()
                    if text and len(text) > 80:
                        return text.strip()
            except Exception:
                continue
        return ""

    # ─── LINKEDIN ─────────────────────────────────────────────────────────────

    async def apply_linkedin(self, max_jobs: int) -> list:
        """Apply to LinkedIn Easy Apply jobs."""
        jobs_applied = []
        await self._init_browser(headless=False)

        try:
            await self.page.goto("https://www.linkedin.com/login")
            await self._human_delay(2000, 4000)

            print("⚠️  Please log in to LinkedIn manually if prompted...")
            await self.page.wait_for_url("**/feed/**", timeout=60000)
            await self._human_delay(1000, 2000)

            keywords = "+".join(self.filters.get("keywords", ["software engineer"]))
            location = self.filters.get("locations", ["India"])[0]
            search_url = (
                f"https://www.linkedin.com/jobs/search/"
                f"?keywords={keywords}&location={location}&f_AL=true"
            )
            await self.page.goto(search_url)
            await self._human_delay(2000, 3000)

            job_cards = await self.page.query_selector_all(".job-card-container")

            for i, card in enumerate(job_cards[:max_jobs]):
                try:
                    await card.click()
                    await self._human_delay(1500, 2500)

                    title_el   = await self.page.query_selector(".job-details-jobs-unified-top-card__job-title")
                    company_el = await self.page.query_selector(".job-details-jobs-unified-top-card__company-name")
                    loc_el     = await self.page.query_selector(".job-details-jobs-unified-top-card__bullet")

                    title   = (await title_el.inner_text()).strip()   if title_el   else "Unknown"
                    company = (await company_el.inner_text()).strip() if company_el else "Unknown"
                    loc     = (await loc_el.inner_text()).strip()     if loc_el     else ""

                    # Scrape JD then get resume (tailored or base)
                    jd = await self._scrape_jd([
                        ".jobs-description__content",
                        ".jobs-box__html-content",
                        "#job-details",
                    ])
                    resume_path = await self._get_resume_for_job(jd, title, company)

                    easy_apply_btn = await self.page.query_selector(".jobs-apply-button--top-card")
                    if not easy_apply_btn:
                        continue

                    await easy_apply_btn.click()
                    await self._human_delay(1500, 2000)

                    applied = await self._handle_linkedin_form(resume_path)

                    if applied:
                        jobs_applied.append({
                            "platform": "linkedin",
                            "title": title,
                            "company": company,
                            "location": loc,
                            "url": self.page.url,
                            "tailored": self.tailor_enabled,
                        })
                        print(f"✅ Applied: {title} @ {company}")

                    await self._human_delay(2000, 4000)

                except Exception as e:
                    print(f"❌ Error on LinkedIn job {i}: {e}")
                    continue

        finally:
            await self._cleanup()

        return jobs_applied

    async def _handle_linkedin_form(self, resume_path: str) -> bool:
        """Navigate LinkedIn Easy Apply multi-step form."""
        for step in range(10):
            await self._human_delay(800, 1500)

            # Upload resume if file input present
            file_input = await self.page.query_selector("input[type='file']")
            if file_input:
                await file_input.set_input_files(resume_path)
                await self._human_delay(600, 1200)

            phone_field = await self.page.query_selector("input[id*='phoneNumber']")
            if phone_field:
                val = await phone_field.input_value()
                if not val:
                    await phone_field.fill(self.profile.get("phone", ""))

            submit_btn = await self.page.query_selector("button[aria-label='Submit application']")
            review_btn = await self.page.query_selector("button[aria-label='Review your application']")
            next_btn   = await self.page.query_selector("button[aria-label='Continue to next step']")

            if submit_btn:
                await submit_btn.click()
                await self._human_delay(1000, 2000)
                dismiss = await self.page.query_selector("button[aria-label='Dismiss']")
                if dismiss:
                    await dismiss.click()
                return True
            elif review_btn:
                await review_btn.click()
            elif next_btn:
                await next_btn.click()
            else:
                break

        return False

    # ─── INDEED ───────────────────────────────────────────────────────────────

    async def apply_indeed(self, max_jobs: int) -> list:
        """Apply to Indeed jobs."""
        jobs_applied = []
        await self._init_browser(headless=False)

        try:
            keywords = " ".join(self.filters.get("keywords", ["software engineer"]))
            location = self.filters.get("locations", ["India"])[0]
            search_url = (
                f"https://in.indeed.com/jobs"
                f"?q={keywords.replace(' ', '+')}&l={location.replace(' ', '+')}"
            )
            await self.page.goto(search_url)
            await self._human_delay(2000, 3000)

            job_cards = await self.page.query_selector_all(".job_seen_beacon")

            for i, card in enumerate(job_cards[:max_jobs]):
                try:
                    await card.click()
                    await self._human_delay(1500, 2500)

                    title_el   = await self.page.query_selector(".jobsearch-JobInfoHeader-title")
                    company_el = await self.page.query_selector("[data-company-name='true']")

                    title   = (await title_el.inner_text()).strip()   if title_el   else "Unknown"
                    company = (await company_el.inner_text()).strip() if company_el else "Unknown"

                    jd = await self._scrape_jd([
                        "#jobDescriptionText",
                        ".jobsearch-jobDescriptionText",
                    ])
                    resume_path = await self._get_resume_for_job(jd, title, company)

                    apply_btn = await self.page.query_selector("#indeedApplyButton")
                    if not apply_btn:
                        continue

                    await apply_btn.click()
                    await self._human_delay(2000, 3000)

                    # Upload resume in Indeed modal if file input present
                    file_input = await self.page.query_selector("input[type='file']")
                    if file_input:
                        await file_input.set_input_files(resume_path)
                        await self._human_delay(600, 1200)

                    jobs_applied.append({
                        "platform": "indeed",
                        "title": title,
                        "company": company,
                        "location": location,
                        "url": self.page.url,
                        "tailored": self.tailor_enabled,
                    })
                    print(f"✅ Applied: {title} @ {company}")
                    await self._human_delay(3000, 5000)

                except Exception as e:
                    print(f"❌ Error on Indeed job {i}: {e}")
                    continue

        finally:
            await self._cleanup()

        return jobs_applied

    # ─── NAUKRI ───────────────────────────────────────────────────────────────

    async def apply_naukri(self, max_jobs: int) -> list:
        """Apply to Naukri.com jobs."""
        jobs_applied = []
        await self._init_browser(headless=False)

        try:
            await self.page.goto("https://www.naukri.com/mnjuser/login")
            await self._human_delay(2000, 4000)
            print("⚠️  Please log in to Naukri manually if prompted...")
            await self.page.wait_for_url("https://www.naukri.com/**", timeout=60000)

            keywords = "-".join(self.filters.get("keywords", ["software engineer"]))
            location = self.filters.get("locations", ["India"])[0].lower()
            search_url = f"https://www.naukri.com/{keywords}-jobs-in-{location}"

            await self.page.goto(search_url)
            await self._human_delay(2000, 3000)

            job_tuples = await self.page.query_selector_all(".srp-jobtuple-wrapper")

            for i, card in enumerate(job_tuples[:max_jobs]):
                try:
                    title_el    = await card.query_selector(".row1 .title")
                    company_el  = await card.query_selector(".row1 .comp-name")
                    location_el = await card.query_selector(".locWdth")
                    apply_btn   = await card.query_selector("button.btn-sm")

                    title   = (await title_el.inner_text()).strip()    if title_el    else "Unknown"
                    company = (await company_el.inner_text()).strip()  if company_el  else "Unknown"
                    loc     = (await location_el.inner_text()).strip() if location_el else ""

                    if not apply_btn:
                        continue
                    apply_text = await apply_btn.inner_text()
                    if "Apply" not in apply_text:
                        continue

                    # Click job to get JD
                    await card.click()
                    await self._human_delay(1200, 2000)

                    jd = await self._scrape_jd([
                        ".job-desc",
                        ".jd-desc",
                        "#job-description",
                    ])
                    resume_path = await self._get_resume_for_job(jd, title, company)

                    # Upload updated resume to Naukri profile if file upload is available
                    file_input = await self.page.query_selector("input[type='file']")
                    if file_input:
                        await file_input.set_input_files(resume_path)
                        await self._human_delay(500, 1000)

                    await apply_btn.click()
                    await self._human_delay(2000, 3000)

                    jobs_applied.append({
                        "platform": "naukri",
                        "title": title,
                        "company": company,
                        "location": loc,
                        "url": self.page.url,
                        "tailored": self.tailor_enabled,
                    })
                    print(f"✅ Applied: {title} @ {company}")
                    await self._human_delay(2000, 4000)

                except Exception as e:
                    print(f"❌ Error on Naukri job {i}: {e}")
                    continue

        finally:
            await self._cleanup()

        return jobs_applied

    # ─── INTERNSHALA ──────────────────────────────────────────────────────────

    async def apply_internshala(self, max_jobs: int) -> list:
        """Apply to Internshala jobs/internships."""
        jobs_applied = []
        await self._init_browser(headless=False)

        try:
            await self.page.goto("https://internshala.com/login/student")
            await self._human_delay(2000, 4000)
            print("⚠️  Please log in to Internshala manually if prompted...")
            await self.page.wait_for_url("**/student/dashboard**", timeout=60000)

            keywords = self.filters.get("keywords", ["software"])[0]
            search_url = f"https://internshala.com/jobs/{keywords.lower().replace(' ', '-')}-jobs"

            await self.page.goto(search_url)
            await self._human_delay(2000, 3000)

            job_cards = await self.page.query_selector_all(".individual_internship")

            for i, card in enumerate(job_cards[:max_jobs]):
                try:
                    title_el    = await card.query_selector(".job-internship-name")
                    company_el  = await card.query_selector(".company-name")
                    location_el = await card.query_selector(".location_link")

                    title   = (await title_el.inner_text()).strip()    if title_el    else "Unknown"
                    company = (await company_el.inner_text()).strip()  if company_el  else "Unknown"
                    loc     = (await location_el.inner_text()).strip() if location_el else "Remote"

                    await card.click()
                    await self._human_delay(1500, 2500)

                    jd = await self._scrape_jd([
                        ".internship_details",
                        ".about_company_text_container",
                        "#about-internship",
                    ])
                    resume_path = await self._get_resume_for_job(jd, title, company)

                    apply_btn = await self.page.query_selector("#apply_button")
                    if not apply_btn:
                        await self.page.go_back()
                        continue

                    await apply_btn.click()
                    await self._human_delay(1500, 2000)

                    # Upload tailored resume if file input exists
                    file_input = await self.page.query_selector("input[type='file']")
                    if file_input:
                        await file_input.set_input_files(resume_path)
                        await self._human_delay(500, 1000)

                    cover_letter = await self.page.query_selector("textarea.cover_letter_ta")
                    if cover_letter:
                        await cover_letter.fill(self._generate_cover_letter(title, company))
                        await self._human_delay(500, 1000)

                    submit_btn = await self.page.query_selector("button[type='submit']")
                    if submit_btn:
                        await submit_btn.click()
                        await self._human_delay(1000, 2000)

                    jobs_applied.append({
                        "platform": "internshala",
                        "title": title,
                        "company": company,
                        "location": loc,
                        "url": self.page.url,
                        "tailored": self.tailor_enabled,
                    })
                    print(f"✅ Applied: {title} @ {company}")
                    await self._human_delay(3000, 5000)
                    await self.page.go_back()
                    await self._human_delay(1000, 2000)

                except Exception as e:
                    print(f"❌ Error on Internshala job {i}: {e}")
                    await self.page.go_back()
                    continue

        finally:
            await self._cleanup()

        return jobs_applied

    # ─── HIRIST ───────────────────────────────────────────────────────────────

    async def apply_hirist(self, max_jobs: int) -> list:
        """Apply to tech jobs on Hirist.tech."""
        jobs_applied = []
        await self._init_browser(headless=False)

        try:
            await self.page.goto("https://www.hirist.tech/login")
            await self._human_delay(2000, 4000)
            print("⚠️  Please log in to Hirist manually if prompted...")
            await self.page.wait_for_function(
                "() => !window.location.href.includes('/login')", timeout=60000
            )
            await self._human_delay(1000, 2000)

            keywords = self.filters.get("keywords", ["software engineer"])[0]
            location = self.filters.get("locations", ["India"])[0]
            search_url = (
                f"https://www.hirist.tech/jobs"
                f"?q={keywords.replace(' ', '%20')}"
                f"&location={location.replace(' ', '%20')}"
            )
            await self.page.goto(search_url)
            await self._human_delay(2000, 3000)

            job_cards = await self.page.query_selector_all(
                ".job-card, .job-listing-card, [class*='jobCard']"
            )

            for i, card in enumerate(job_cards[:max_jobs]):
                try:
                    title_el    = await card.query_selector("[class*='title'], h2, h3")
                    company_el  = await card.query_selector("[class*='company'], [class*='employer']")
                    location_el = await card.query_selector("[class*='location'], [class*='loc']")

                    title   = (await title_el.inner_text()).strip()    if title_el    else "Unknown"
                    company = (await company_el.inner_text()).strip()  if company_el  else "Unknown"
                    loc     = (await location_el.inner_text()).strip() if location_el else location

                    await card.click()
                    await self._human_delay(1500, 2500)

                    jd = await self._scrape_jd([
                        "[class*='job-description']",
                        "[class*='jobDesc']",
                        ".description",
                    ])
                    resume_path = await self._get_resume_for_job(jd, title, company)

                    apply_btn = await self.page.query_selector(
                        "button:has-text('Apply'), a:has-text('Apply Now'), [class*='apply-btn']"
                    )
                    if not apply_btn:
                        await self.page.go_back()
                        continue

                    await apply_btn.click()
                    await self._human_delay(1500, 2500)

                    applied = await self._handle_hirist_modal(resume_path)

                    if applied:
                        jobs_applied.append({
                            "platform": "hirist",
                            "title": title,
                            "company": company,
                            "location": loc,
                            "url": self.page.url,
                            "tailored": self.tailor_enabled,
                        })
                        print(f"✅ Applied: {title} @ {company}")

                    await self._human_delay(2000, 3500)
                    await self.page.go_back()
                    await self._human_delay(1000, 2000)

                except Exception as e:
                    print(f"❌ Error on Hirist job {i}: {e}")
                    try:
                        await self.page.go_back()
                    except Exception:
                        pass
                    continue

        finally:
            await self._cleanup()

        return jobs_applied

    async def _handle_hirist_modal(self, resume_path: str) -> bool:
        """Handle Hirist quick-apply modal."""
        await self._human_delay(800, 1500)

        file_input = await self.page.query_selector("input[type='file']")
        if file_input:
            await file_input.set_input_files(resume_path)
            await self._human_delay(500, 1000)

        submit_btn = await self.page.query_selector(
            "button:has-text('Submit'), button:has-text('Confirm'), button:has-text('Send Application')"
        )
        if submit_btn:
            await submit_btn.click()
            await self._human_delay(1000, 2000)
            return True

        return True  # external ATS redirect — mark as attempted

    # ─── INSTAHIRE ────────────────────────────────────────────────────────────

    async def apply_instahire(self, max_jobs: int) -> list:
        """Apply to jobs on Instahire.io."""
        jobs_applied = []
        await self._init_browser(headless=False)

        try:
            await self.page.goto("https://instahire.io/login")
            await self._human_delay(2000, 4000)
            print("⚠️  Please log in to Instahire manually if prompted...")
            await self.page.wait_for_function(
                "() => !window.location.href.includes('/login')", timeout=60000
            )
            await self._human_delay(1000, 2000)

            keywords = self.filters.get("keywords", ["software engineer"])[0]
            location = self.filters.get("locations", ["India"])[0]
            search_url = (
                f"https://instahire.io/jobs"
                f"?search={keywords.replace(' ', '+')}"
                f"&location={location.replace(' ', '+')}"
            )
            await self.page.goto(search_url)
            await self._human_delay(2000, 3000)

            job_cards = await self.page.query_selector_all(
                ".job-card, .job-item, [class*='jobCard'], [class*='job-listing']"
            )

            for i, card in enumerate(job_cards[:max_jobs]):
                try:
                    title_el    = await card.query_selector("h2, h3, [class*='title']")
                    company_el  = await card.query_selector("[class*='company'], [class*='employer']")
                    location_el = await card.query_selector("[class*='location'], [class*='city']")

                    title   = (await title_el.inner_text()).strip()    if title_el    else "Unknown"
                    company = (await company_el.inner_text()).strip()  if company_el  else "Unknown"
                    loc     = (await location_el.inner_text()).strip() if location_el else location

                    await card.click()
                    await self._human_delay(1500, 2500)

                    jd = await self._scrape_jd([
                        "[class*='job-description']",
                        "[class*='description']",
                        ".details",
                    ])
                    resume_path = await self._get_resume_for_job(jd, title, company)

                    apply_btn = await self.page.query_selector(
                        "button:has-text('Apply'), a:has-text('Apply'), [class*='apply']"
                    )
                    if not apply_btn:
                        await self.page.go_back()
                        continue

                    await apply_btn.click()
                    await self._human_delay(1500, 2500)

                    applied = await self._handle_instahire_form(title, company, resume_path)

                    if applied:
                        jobs_applied.append({
                            "platform": "instahire",
                            "title": title,
                            "company": company,
                            "location": loc,
                            "url": self.page.url,
                            "tailored": self.tailor_enabled,
                        })
                        print(f"✅ Applied: {title} @ {company}")

                    await self._human_delay(2000, 4000)
                    await self.page.go_back()
                    await self._human_delay(1000, 2000)

                except Exception as e:
                    print(f"❌ Error on Instahire job {i}: {e}")
                    try:
                        await self.page.go_back()
                    except Exception:
                        pass
                    continue

        finally:
            await self._cleanup()

        return jobs_applied

    async def _handle_instahire_form(self, title: str, company: str, resume_path: str) -> bool:
        """Handle Instahire application form / modal."""
        await self._human_delay(800, 1500)

        file_input = await self.page.query_selector("input[type='file']")
        if file_input:
            await file_input.set_input_files(resume_path)
            await self._human_delay(600, 1200)

        cover_field = await self.page.query_selector(
            "textarea, input[placeholder*='cover'], input[placeholder*='message']"
        )
        if cover_field:
            await cover_field.fill(self._generate_cover_letter(title, company))
            await self._human_delay(500, 900)

        phone_field = await self.page.query_selector(
            "input[type='tel'], input[placeholder*='phone']"
        )
        if phone_field:
            current = await phone_field.input_value()
            if not current:
                await phone_field.fill(self.profile.get("phone", ""))
            await self._human_delay(300, 700)

        submit_btn = await self.page.query_selector(
            "button[type='submit'], button:has-text('Submit'), button:has-text('Apply Now')"
        )
        if submit_btn:
            await submit_btn.click()
            await self._human_delay(1000, 2000)
            return True

        return False

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _generate_cover_letter(self, title: str, company: str) -> str:
        skills = ", ".join(self.profile.get("skills", [])[:4])
        years  = self.profile.get("experience_years", 0)
        return (
            f"I am excited to apply for the {title} position at {company}. "
            f"With {years} years of experience and expertise in {skills}, "
            f"I am confident I can contribute meaningfully to your team. "
            f"I look forward to discussing how my background aligns with your needs."
        )

    # ─── Main dispatcher ──────────────────────────────────────────────────────

    async def apply_jobs(self, platform: str, max_jobs: int = 10) -> list:
        dispatch = {
            "linkedin":    self.apply_linkedin,
            "indeed":      self.apply_indeed,
            "naukri":      self.apply_naukri,
            "internshala": self.apply_internshala,
            "hirist":      self.apply_hirist,
            "instahire":   self.apply_instahire,
        }
        handler = dispatch.get(platform.lower())
        if not handler:
            raise ValueError(f"Unsupported platform: {platform}")
        return await handler(max_jobs)
