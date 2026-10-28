// Official front book covers for NetLib catalog
export const BOOK_COVERS: Record<string, string> = {
  // Core Java series - exact publisher edition covers
  'code-java-vol-i-fundamentals-14th-edition':
    'https://www.oreilly.com/covers/urn:orm:book:9780135558553/296w/?format=webp',
  'core-java-vol-i-fundamentals-14th-edition':
    'https://www.oreilly.com/covers/urn:orm:book:9780135558553/296w/?format=webp',

  'core-java-vol-2-14th-edition':
    'https://www.oreilly.com/covers/urn:orm:book:9780135558775/296w/?format=webp',

  'core-java-volume-i-fundamentals-13th-edition':
    'https://www.oreilly.com/covers/urn:orm:book:9780135328385/296w/?format=webp',

  'core-java-vol-13-ii':
    'https://www.oreilly.com/covers/urn:orm:book:9780135371671/296w/?format=webp',

  'core-java-for-the-impatient-4th-edition':
    'https://www.oreilly.com/covers/urn:orm:book:9780135404522/296w/?format=webp',

  'core-java-vol-12-i':
    'https://www.oreilly.com/covers/urn:orm:book:9780137673810/296w/?format=webp',

  'core-java-vol-ii-advanced-features-12th-edition':
    'https://www.oreilly.com/covers/urn:orm:book:9780137870899/296w/?format=webp',

  // Spring & Microservices covers
  'building-intelligent-applications-with-spring-ai-by-john-blum':
    'https://www.oreilly.com/covers/urn:orm:book:9781836204619/296w/?format=webp',

  'building-microservices-2nd-edition-en-by-sam-newman':
    'https://www.oreilly.com/covers/urn:orm:book:9781492034018/296w/?format=webp',

  // AI Engineering by Chip Huyen
  'ai-engineering-en-by-chip-huyen':
    'https://covers.openlibrary.org/b/id/15091156-L.jpg',

  // Designing Data-Intensive Applications by Martin Kleppmann
  'designing-data-intensive-applications-2nd-edition-en-by-martin-kleppmann-chris-r':
    'https://covers.openlibrary.org/b/id/8434671-L.jpg',
  'designing-data-intensive-applications-2nd-edition-en-by-martin-kleppmann-chris-riccomini':
    'https://covers.openlibrary.org/b/id/8434671-L.jpg',

  // Fundamentals of Software Architecture by Mark Richards & Neal Ford
  'fundamentals-of-software-architecture-2nd-edition-by-mark-richards-neal-ford':
    'https://covers.openlibrary.org/b/id/10193363-L.jpg',

  // Head First Java (3rd Edition)
  'head-first-java':
    'https://covers.openlibrary.org/b/id/388761-L.jpg',

  // Kubernetes: Up and Running (3rd Edition)
  'kubernetes-up-and-running-3rd-edition-en-by-brendan-burns-joe-beda-kelsey-highto':
    'https://covers.openlibrary.org/b/id/8509547-L.jpg',
  'kubernetes-up-and-running-3rd-edition-en-by-brendan-burns-joe-beda-kelsey-hightower-lachlan-evenson':
    'https://covers.openlibrary.org/b/id/8509547-L.jpg',

  // Site Reliability Engineering
  'site-reliability-engineering-2nd-edition-en-by-betsy-beyer-chris-jones-christof-':
    'https://covers.openlibrary.org/b/id/9196682-L.jpg',
  'site-reliability-engineering-2nd-edition-en-by-betsy-beyer-chris-jones-christof-leng-david-huska-jennifer-petoff-niall-richard-murphy':
    'https://covers.openlibrary.org/b/id/9196682-L.jpg',

  // Software Architecture: The Hard Parts
  'software-architecture-the-hard-parts-en-by-neal-ford-mark-richards-pramod-sadala':
    'https://covers.openlibrary.org/b/id/12318698-L.jpg',
  'software-architecture-the-hard-parts-en-by-neal-ford-mark-richards-pramod-sadalage-zhamak-dehghani':
    'https://covers.openlibrary.org/b/id/12318698-L.jpg',

  // The Well-Grounded Java Developer (2nd Edition)
  'the-well-grounded-java-developer-second-edition-by-jason-clark-martijn-verburg-b':
    'https://covers.openlibrary.org/b/id/7505404-L.jpg',
  'the-well-grounded-java-developer-second-edition-by-jason-clark-martijn-verburg-benjamin-evans':
    'https://covers.openlibrary.org/b/id/7505404-L.jpg',
};

export function getBookCoverUrl(bookId: string, directCoverUrl?: string): string | null {
  if (directCoverUrl) return directCoverUrl;
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(`netlib_cover_${bookId}`);
      if (cached) return cached;
    } catch {
      // ignore
    }
  }
  return BOOK_COVERS[bookId] || null;
}
