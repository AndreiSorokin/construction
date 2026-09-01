// Сид первой организации после `prisma migrate reset`.
// Старые тестовые данные не переносим — приложение теперь мультитенантное,
// дальше оргструктуру/сотрудников/справочники создаёт сам админ через UI.
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.create({
    data: { name: 'Интерстиль', slug: 'interstil' },
  });

  const passwordHash = await bcrypt.hash('admin', 12);
  const admin = await prisma.user.create({
    data: {
      organizationId: org.id,
      login: 'admin',
      name: 'Администратор',
      role: 'ADMIN',
      passwordHash,
      ordersAccess: true,
      canPrice: true,
    },
  });

  await prisma.appSetting.create({ data: { organizationId: org.id } });

  // eslint-disable-next-line no-console
  console.log(`Организация «${org.name}» (${org.slug}) создана. Логин: ${admin.login} / пароль: admin`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
