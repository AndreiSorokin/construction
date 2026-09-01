// Транслитерация кириллицы + приведение к виду, пригодному для поддомена {slug}.interstil.kz

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

const RESERVED = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'ftp', 'localhost', 'staging', 'test',
  'dev', 'ck', 'static', 'assets', 'cdn', 'root', 'support', 'help',
]);

export function slugify(input: string): string {
  const translit = input
    .toLowerCase()
    .split('')
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join('');
  const slug = translit
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug.slice(0, 48);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug) || slug.length < 2;
}
