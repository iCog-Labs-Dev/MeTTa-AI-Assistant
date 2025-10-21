import json
import re
import codecs
from typing import List, Dict, Any, Optional
from pathlib import Path
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
import requests


class UniversalMettaScraper:
    def __init__(self, site_name: str = "metta-lang.dev", delay: float = 1.0):
        self.site_name = site_name
        self.delay = delay
        self.visited = set()
        self.pages: List[Dict[str, Any]] = []

        # Site configurations
        self.sites_config = {
            "metta-lang.dev": {
                "base_url": "https://metta-lang.dev",
                "needs_js": True,
                "link_patterns": ["/docs/learn/"],
                "file_extensions": [".html"],
                "hub_url": "/docs/learn/learn.html",
                "link_selectors": [
                    'a[href^="/docs/learn/tutorials/"]',
                    'a[href^="/docs/learn/"]',
                ],
            },
            "metta-stdlib.readthedocs.io": {
                "base_url": "https://metta-stdlib.readthedocs.io",
                "needs_js": False,
                "link_patterns": ["/en/latest/", "/", ""],
                "file_extensions": [".html", ""],
                "hub_url": "/",
                "link_selectors": [
                    'a[href^="/en/latest/"]',
                    'a[href^="/"]',
                    'a[href$=".html"]',
                ],
            },
            "metta-learner-playground.vercel.app": {
                "base_url": "https://metta-learner-playground.vercel.app",
                "needs_js": True,
                "link_patterns": [
                    "/functional-programming",
                    "/installation",
                    "/what-is-metta",
                    "/atomspace",
                    "/glossary",
                    "/references",
                    "/best-practices",
                    "/nondeterminism",
                    "/recursion",
                    "/standard-library",
                    "/projects/family-tree",
                    "/projects/python-integration",
                    "/projects/neuro-symbolic",
                    "/projects/list-utils",
                    "/contribute",
                ],
                "file_extensions": [""],
                "hub_url": "/",
                "link_selectors": ['a[href^="/"]'],
            },
        }

        if site_name not in self.sites_config:
            raise ValueError(
                f"Unknown site: {site_name}. Available sites: {list(self.sites_config.keys())}"
            )

        self.config = self.sites_config[site_name]
        self.base_url = self.config["base_url"]

    async def fetch_page(self, url: str) -> str:
        """Fetch HTML content, using Playwright only when needed."""
        if url in self.visited:
            print(f"Skipping already visited: {url}")
            return ""

        try:
            if self.config["needs_js"]:
                # Use Playwright for JavaScript-heavy sites
                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True)
                    page = await browser.new_page()
                    await page.goto(url, wait_until="networkidle")
                    content = await page.content()
                    await browser.close()
            else:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                content = response.text

            self.visited.add(url)
            import asyncio

            await asyncio.sleep(self.delay)
            print(f"Successfully fetched: {url}")
            return content

        except Exception as e:
            print(f"Error fetching {url}: {str(e)}")
            return ""

    async def extract_tutorial_urls(self, hub_url: str) -> List[str]:
        """Extract all relevant links based on site configuration."""
        full_hub_url = urljoin(self.base_url, hub_url)
        html = await self.fetch_page(full_hub_url)
        if not html:
            print(f"No content fetched for hub: {full_hub_url}")
            return []

        soup = BeautifulSoup(html, "lxml")
        urls = []

        for selector in self.config["link_selectors"]:
            links = soup.select(selector)
            for link in links:
                href = link.get("href")
                if href:
                    # Special handling for ReadTheDocs relative links
                    if (
                        self.site_name == "metta-stdlib.readthedocs.io"
                        and href.endswith(".html")
                        and not href.startswith("/")
                    ):
                        # Convert relative .html links to /en/latest/ format
                        href = f"/en/latest/{href}"

                    full_url = urljoin(self.base_url, href)
                    parsed = urlparse(full_url)

                    if self._is_valid_url(parsed.path):
                        urls.append(full_url)

        urls = list(set(urls))
        urls = [url for url in urls if self._should_scrape_url(url)]

        print(f"Discovered {len(urls)} URLs for {self.site_name}")
        return urls

    def _is_valid_url(self, path: str) -> bool:
        """Check if URL path matches site patterns."""
        for pattern in self.config["link_patterns"]:
            if path.startswith(pattern):
                return True
        return False

    def _should_scrape_url(self, url: str) -> bool:
        """Determine if URL should be scraped based on site rules."""
        parsed = urlparse(url)
        path = parsed.path

        # Skip external links
        if parsed.netloc != urlparse(self.base_url).netloc:
            return False

        # Skip fragments and query parameters
        if "#" in url or "?" in url:
            url = url.split("#")[0].split("?")[0]

        # Check file extensions
        if self.config["file_extensions"]:
            has_valid_extension = any(
                path.endswith(ext) or (ext == "" and not path.endswith(".html"))
                for ext in self.config["file_extensions"]
            )
            if not has_valid_extension:
                return False

        # Site-specific filtering
        if self.site_name == "metta-learner-playground.vercel.app":
            return any(
                path.startswith(pattern) for pattern in self.config["link_patterns"]
            )
        elif self.site_name == "metta-lang.dev":
            return "learn" in path and path.endswith(".html")
        elif self.site_name == "metta-stdlib.readthedocs.io":
            skip_paths = ["/_static/", "/_sources/", "/search.html", "/genindex.html"]
            return not any(
                path.startswith(skip) for skip in skip_paths
            ) and path.endswith(".html")

        return True

    def classify_page(self, url: str, content: str) -> str:
        """Classify the page based on URL and content."""
        path = urlparse(url).path.lower()
        content_lower = content.lower()

        # Site-specific classification
        if self.site_name == "metta-stdlib.readthedocs.io":
            return "Standard Library Documentation"

        elif self.site_name == "metta-learner-playground.vercel.app":
            if "installation" in path:
                return "Installation Guide"
            elif "what-is-metta" in path:
                return "Introduction"
            elif "functional-programming" in path:
                return "Functional Programming"
            elif "atomspace" in path:
                return "Atomspace"
            elif "nondeterminism" in path:
                return "Non-determinism"
            elif "recursion" in path:
                return "Recursion"
            elif "standard-library" in path:
                return "Standard Library"
            elif "best-practices" in path:
                return "Best Practices"
            elif "glossary" in path:
                return "Glossary"
            elif "references" in path:
                return "References"
            elif "projects" in path:
                return "Projects"
            elif "contribute" in path:
                return "Contribution"
            else:
                return "MeTTa Learning Content"

        elif self.site_name == "metta-lang.dev":
            if "stdlib_overview" in path:
                return "Standard Library"
            if "working_with_spaces" in path or "space" in content_lower:
                return "Space API"
            if "eval" in path or "evaluation" in content_lower:
                return "Evaluation"
            return "MeTTa Tutorial"

        return "MeTTa Content"

    def _extract_text_with_links(self, elem: BeautifulSoup) -> str:
        """Recursively extract text from an element, annotating GitHub links as text(url)."""
        text_parts = []
        for child in elem.children:
            if isinstance(child, str):
                text_parts.append(child.strip())
            elif child.name == "a":
                href = child.get("href")
                if href and href.startswith("https://github.com"):
                    link_text = child.get_text(strip=True)
                    full_url = (
                        urljoin(self.base_url, href) if href.startswith("/") else href
                    )
                    text_parts.append(f"{link_text}({full_url})")
                else:
                    text_parts.append(child.get_text(strip=True))
            else:
                # Recurse for nested elements (e.g., spans, em, etc.)
                text_parts.append(self._extract_text_with_links(child))
        return " ".join(filter(None, text_parts))

    async def extract_page_content(
        self, soup: BeautifulSoup, url: str
    ) -> Dict[str, Any]:
        """Extract all content from a page and classify it."""
        content = []
        page_title = soup.find("h1")
        page_title = (
            self._extract_text_with_links(page_title)
            if page_title
            else urlparse(url).path.split("/")[-1]
        )

        # Special handling for metta-learner site with CodeMirror editors
        if self.site_name == "metta-learner-playground.vercel.app":
            content.extend(await self._extract_vercel_content(soup, url))
        else:
            # Standard extraction for other sites
            content.extend(self._extract_standard_content(soup))

        content_text = "\n".join(filter(None, content))
        content_text = self._clean_text(content_text)

        return {
            "page_id": len(self.pages),
            "url": url,
            "page_title": page_title,
            "category": self.classify_page(url, content_text),
            "content": content_text,
            "content_length": len(content_text.split()),
        }

    async def _extract_vercel_content(self, soup: BeautifulSoup, url: str) -> List[str]:
        """Extract content specifically for metta-learner site with CodeMirror editors."""
        content = []

        # Extract regular content first
        for elem in soup.find_all(["h1", "h2", "h3", "h4", "p", "ul", "ol", "table"]):
            if elem.name.startswith("h"):
                content.append(self._extract_text_with_links(elem))
            elif elem.name in ["ul", "ol"]:
                list_text = []
                for li in elem.find_all("li", recursive=False):
                    li_text = self._extract_text_with_links(li)
                    list_text.append(f"- {li_text}")
                content.append("\n".join(list_text))
            elif elem.name == "table":
                rows = []
                for tr in elem.find_all("tr"):
                    cells = []
                    for td in tr.find_all(["td", "th"]):
                        cell_text = self._extract_text_with_links(td)
                        cells.append(cell_text.strip())
                    rows.append("| " + " | ".join(cells) + " |")
                content.append("\n".join(rows))
            else:
                content.append(self._extract_text_with_links(elem))

        content.extend(await self._extract_codemirror_content(url))

        return content

    async def _extract_codemirror_content(self, url: str) -> List[str]:
        """Extract content from CodeMirror editors using Playwright."""
        if not self.config["needs_js"]:
            return []

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.goto(url, wait_until="networkidle")

                await page.wait_for_timeout(2000)

                code_blocks = []

                cm_content_divs = await page.query_selector_all(".cm-content")

                for i, div in enumerate(cm_content_divs):
                    try:
                        code_text = await div.inner_text()
                        if code_text and code_text.strip():
                            code_blocks.append(f"```metta\n{code_text.strip()}\n```")
                    except Exception as e:
                        print(f"Error extracting CodeMirror content {i}: {e}")

                await browser.close()
                return code_blocks

        except Exception as e:
            print(f"Error extracting CodeMirror content: {e}")
            return []

    def _extract_standard_content(self, soup: BeautifulSoup) -> List[str]:
        """Extract content using standard HTML parsing."""
        content = []

        for elem in soup.find_all(
            ["h1", "h2", "h3", "h4", "p", "ul", "ol", "pre", "table"]
        ):
            if elem.name.startswith("h"):
                content.append(self._extract_text_with_links(elem))
            elif elem.name == "pre":
                # Enhanced extraction for ReadTheDocs and similar: handle both <pre><code> and direct <pre> text
                code_elem = elem.find("code")
                if code_elem:
                    code_text = code_elem.text.strip()
                else:
                    code_text = elem.text.strip()

                if code_text:
                    code_text = re.sub(
                        r"<span.*?</span>", "", code_text, flags=re.DOTALL
                    )
                    code_text = BeautifulSoup(code_text, "lxml").text.strip()
                    content.append(f"```metta\n{code_text}\n```")
            elif elem.name in ["ul", "ol"]:
                list_text = []
                for li in elem.find_all("li", recursive=False):
                    li_text = self._extract_text_with_links(li)
                    list_text.append(f"- {li_text}")
                content.append("\n".join(list_text))
            elif elem.name == "table":
                rows = []
                for tr in elem.find_all("tr"):
                    cells = []
                    for td in tr.find_all(["td", "th"]):
                        cell_text = self._extract_text_with_links(td)
                        cells.append(cell_text.strip())
                    rows.append("| " + " | ".join(cells) + " |")
                content.append("\n".join(rows))
            else:
                content.append(self._extract_text_with_links(elem))

        return content

    @staticmethod
    def _clean_text(text: str) -> str:
        """Clean and normalize text, decoding Unicode escapes and removing doc artifacts."""
        text = codecs.decode(text, "unicode_escape")

        text = re.sub(r"¶", "", text)
        text = re.sub(r"© Copyright.*", "", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    async def scrape_all(self, hub_url: Optional[str] = None) -> List[Dict[str, Any]]:
        """Scrape all pages and classify by page."""
        if hub_url is None:
            hub_url = self.config["hub_url"]

        tutorial_urls = await self.extract_tutorial_urls(hub_url)

        hub_html = await self.fetch_page(urljoin(self.base_url, hub_url))
        if hub_html:
            soup = BeautifulSoup(hub_html, "lxml")
            self.pages.append(
                await self.extract_page_content(soup, urljoin(self.base_url, hub_url))
            )

        for url in tutorial_urls:
            html = await self.fetch_page(url)
            if html:
                soup = BeautifulSoup(html, "lxml")
                self.pages.append(await self.extract_page_content(soup, url))
                print(f"Scraped {url} ({len(self.pages)} pages so far)")

        return self.pages


async def scrape_site(site_name: str, delay: float = 1.0) -> List[Dict[str, Any]]:
    scraper = UniversalMettaScraper(site_name=site_name, delay=delay)
    pages = await scraper.scrape_all()
    return pages
