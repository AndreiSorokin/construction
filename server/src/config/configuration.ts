export default () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  webOrigin: (process.env.WEB_ORIGIN || 'http://localhost:3000').split(','),
  org: {
    // корневой домен, на котором раздаются поддомены организаций: {slug}.<rootDomain>
    rootDomain: process.env.ORG_ROOT_DOMAIN || 'interstil.kz',
    // фолбэк для локальной разработки (нет реальных поддоменов) — X-Org-Slug переопределяет
    defaultSlug: process.env.ORG_DEFAULT_SLUG || 'interstil',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS || '30', 10),
  },
  cookie: {
    secure: (process.env.COOKIE_SECURE || 'false') === 'true',
    sameSite: (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'none' | 'strict',
  },
  s3: {
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    bucket: process.env.S3_BUCKET || 'interstroy',
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || 'true') === 'true',
  },
  mail: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_SECURE || 'false') === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Интерстиль <no-reply@interstroy.local>',
  },
});
