/* Наполнение БД для запуска в работу: орг.структура, доступы, ВСЕ маршруты
   согласования (3 отдела × 7 типов), полные прейскуранты работ (118+116),
   номенклатура, ИП. Демо-заявок/нарядов НЕТ — система чистая для реальной работы.
   Запуск: npm run seed. Повторный запуск на непустой базе будет отклонён. */
import { PrismaClient, Role, RequestType, WorkKind } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { WORKS_STROY, WORKS_ELEKTRO } from './works.data';

const prisma = new PrismaClient();
const hash = (p: string) => bcrypt.hash(p, 12);

async function main() {
  if (await prisma.user.count()) {
    console.log('База уже наполнена — seed пропущен.');
    return;
  }

  // ── отделы ──
  const [stroy, prod, trans] = await Promise.all([
    prisma.department.create({ data: { name: 'Строительный' } }),
    prisma.department.create({ data: { name: 'Производственный' } }),
    prisma.department.create({ data: { name: 'Транспортный' } }),
  ]);

  // ── пользователи (логин / стартовый пароль — СМЕНИТЬ после первого входа) ──
  const U: Record<string, { id: string; name: string }> = {};
  const mk = async (k: string, login: string, pw: string, name: string, role: Role, departmentId?: string, extra: object = {}) => {
    U[k] = await prisma.user.create({
      data: { login, name, role, departmentId: departmentId || null, passwordHash: await hash(pw), ...extra },
    });
  };
  await mk('admin', 'admin', 'admin', 'Администратор', Role.ADMIN);
  await mk('stroyReq', 'prorab', '1111', 'Иванов — прораб', Role.REQUESTER, stroy.id, { ordersAccess: true });
  await mk('prodReq', 'master', '1212', 'Орлов — мастер цеха', Role.REQUESTER, prod.id, { ordersAccess: true });
  await mk('transReq', 'logist', '1313', 'Гайдар — логист', Role.REQUESTER, trans.id);
  await mk('headStroy', 'nstroy', '2001', 'Ахметов — нач. строит. отдела', Role.APPROVER, stroy.id);
  await mk('headTrans', 'ntrans', '2002', 'Жуков — нач. трансп. отдела', Role.APPROVER, trans.id);
  await mk('eng', 'eng', '2222', 'Сидоров — гл. инженер', Role.APPROVER, prod.id);
  await mk('mech', 'mech', '2333', 'Беков — гл. механик', Role.APPROVER, trans.id);
  await mk('fin', 'fin', '3333', 'Ким — финансы', Role.APPROVER);
  await mk('dir', 'dir', '4444', 'Директор', Role.APPROVER);
  // право менять цены в нарядах — у директора (демо)
  await prisma.user.update({ where: { login: 'dir' }, data: { canPrice: true } });
  // настройки приложения: одна строка (лимит «Срочно» = 3 по умолчанию)
  await prisma.appSetting.upsert({ where: { id: 'app' }, create: { id: 'app' }, update: {} });
  await mk('sklad', 'sklad', '6001', 'Нурлан — кладовщик', Role.WAREHOUSE);
  await mk('snab', 'snab', '5555', 'Аскар — снабженец (старший)', Role.SUPPLY, undefined, { isLead: true });
  await mk('snab2', 'snab2', '5556', 'Алия — снабженец', Role.SUPPLY);
  await mk('snab3', 'snab3', '5557', 'Серик — снабженец', Role.SUPPLY);

  // ── объекты + доступ заявителей ──
  const objs = [
    { name: 'ЖК «Сарыарка», блок Б', color: 'sky', users: [U.stroyReq.id] },
    { name: 'Школа №42 (капремонт)', color: 'emerald', users: [U.stroyReq.id] },
    { name: 'Цех металлоконструкций', color: 'violet', users: [U.prodReq.id] },
    { name: 'Автобаза / ремзона', color: 'amber', users: [U.transReq.id] },
    { name: 'Карьер «Восточный»', color: 'lime', users: [U.transReq.id, U.stroyReq.id] },
  ];
  for (const o of objs) {
    await prisma.objectSite.create({
      data: { name: o.name, color: o.color, access: { create: o.users.map((userId) => ({ userId })) } },
    });
  }

  // ── маршруты согласования заявок: ВСЕ отделы × ВСЕ типы (как в прототипе) ──
  const T = RequestType;
  const CH: Record<string, Partial<Record<RequestType, [string, string][]>>> = {
    [stroy.id]: {
      [T.TMC]:        [[U.headStroy.id, 'Нач. отдела'], [U.sklad.id, 'Склад'], [U.eng.id, 'Гл. инженер'], [U.dir.id, 'Директор']],
      [T.TRANSPORT]:  [[U.headStroy.id, 'Нач. отдела'], [U.dir.id, 'Директор']],
      [T.QUARRY]:     [[U.headStroy.id, 'Нач. отдела'], [U.sklad.id, 'Склад'], [U.dir.id, 'Директор']],
      [T.FUNDS]:      [[U.headStroy.id, 'Нач. отдела'], [U.fin.id, 'Финансы'], [U.dir.id, 'Директор']],
      [T.FUEL]:       [[U.headStroy.id, 'Нач. отдела'], [U.sklad.id, 'Склад'], [U.dir.id, 'Директор']],
      [T.TRAVEL]:     [[U.fin.id, 'Финансы'], [U.dir.id, 'Директор']],
      [T.PRODUCTION]: [[U.eng.id, 'Гл. инженер'], [U.dir.id, 'Директор']],
    },
    [prod.id]: {
      [T.TMC]:        [[U.eng.id, 'Гл. инженер'], [U.sklad.id, 'Склад'], [U.dir.id, 'Директор']],
      [T.TRANSPORT]:  [[U.eng.id, 'Гл. инженер'], [U.dir.id, 'Директор']],
      [T.QUARRY]:     [[U.sklad.id, 'Склад'], [U.dir.id, 'Директор']],
      [T.FUNDS]:      [[U.fin.id, 'Финансы'], [U.dir.id, 'Директор']],
      [T.FUEL]:       [[U.sklad.id, 'Склад'], [U.dir.id, 'Директор']],
      [T.TRAVEL]:     [[U.fin.id, 'Финансы'], [U.dir.id, 'Директор']],
      [T.PRODUCTION]: [[U.eng.id, 'Технолог'], [U.dir.id, 'Директор']],
    },
    [trans.id]: {
      [T.TMC]:        [[U.headTrans.id, 'Нач. отдела'], [U.mech.id, 'Гл. механик'], [U.sklad.id, 'Склад'], [U.dir.id, 'Директор']],
      [T.TRANSPORT]:  [[U.headTrans.id, 'Нач. отдела'], [U.dir.id, 'Директор']],
      [T.QUARRY]:     [[U.headTrans.id, 'Нач. отдела'], [U.sklad.id, 'Склад'], [U.dir.id, 'Директор']],
      [T.FUNDS]:      [[U.headTrans.id, 'Нач. отдела'], [U.fin.id, 'Финансы'], [U.dir.id, 'Директор']],
      [T.FUEL]:       [[U.mech.id, 'Гл. механик'], [U.sklad.id, 'Склад'], [U.dir.id, 'Директор']],
      [T.TRAVEL]:     [[U.headTrans.id, 'Нач. отдела'], [U.fin.id, 'Финансы'], [U.dir.id, 'Директор']],
      [T.PRODUCTION]: [[U.mech.id, 'Гл. механик'], [U.dir.id, 'Директор']],
    },
  };
  for (const [departmentId, byType] of Object.entries(CH)) {
    for (const [type, steps] of Object.entries(byType)) {
      await prisma.supplyChainStep.createMany({
        data: (steps as [string, string][]).map(([approverId, label], i) => ({
          departmentId, type: type as RequestType, order: i, approverId, label,
        })),
      });
    }
  }

  // ── маршрут согласования нарядов (строительный отдел) ──
  await prisma.orderChainStep.createMany({
    data: [
      { departmentId: stroy.id, order: 0, approverId: U.headStroy.id, label: 'Нач. участка' },
      { departmentId: stroy.id, order: 1, approverId: U.dir.id, label: 'Директор' },
    ],
  });

  // ── номенклатура снабжения (как в прототипе) ──
  await prisma.catalogItem.createMany({
    data: [
      { name: 'Цемент М500', unit: 'мешок', category: 'Стройматериалы' },
      { name: 'Песок строительный', unit: 'м³', category: 'Стройматериалы' },
      { name: 'Краска фасадная', unit: 'кг', category: 'Отделка' },
      { name: 'Грунтовка глубокого проникновения', unit: 'л', category: 'Отделка' },
      { name: 'Арматура А500С ⌀12', unit: 'т', category: 'Метизы' },
      { name: 'Уголок металлический 50×50', unit: 'м', category: 'Метизы' },
      { name: 'Профлист С8', unit: 'лист', category: 'Метизы' },
      { name: 'Электроды сварочные', unit: 'упак', category: 'Расходники' },
      { name: 'Перчатки рабочие', unit: 'пара', category: 'СИЗ' },
      { name: 'Фильтр масляный', unit: 'шт', category: 'Запчасти' },
      { name: 'Тормозные колодки', unit: 'компл', category: 'Запчасти' },
      { name: 'Дизельное топливо (ДТ)', unit: 'л', category: 'Топливо / ГСМ' },
      { name: 'Бензин АИ-92', unit: 'л', category: 'Топливо / ГСМ' },
      { name: 'Бензин АИ-95', unit: 'л', category: 'Топливо / ГСМ' },
      { name: 'Масло моторное 10W-40', unit: 'л', category: 'Топливо / ГСМ' },
      { name: 'Щебень фр. 5-20', unit: 'м³', category: 'Карьер' },
      { name: 'Щебень фр. 20-40', unit: 'м³', category: 'Карьер' },
      { name: 'Отсев', unit: 'м³', category: 'Карьер' },
      { name: 'ПГС', unit: 'м³', category: 'Карьер' },
    ],
  });

  // ── ИП-подрядчики ──
  await prisma.ip.createMany({
    data: [
      { name: 'ИП Серіков А.Қ.', bin: '880101300123', vat: true },
      { name: 'ИП Нұрланов Б.С.', bin: '910515350456', vat: true },
      { name: 'ИП Қайратова Г.М.', bin: '920820400789', vat: false },
    ],
  });

  // ── полные прейскуранты работ ──
  const mkCatalog = async (name: string, kind: WorkKind, rows: typeof WORKS_STROY) => {
    const c = await prisma.workCatalog.create({ data: { name, kind } });
    await prisma.workItem.createMany({
      data: rows.map(([n, unit, price, dsu]) => ({ catalogId: c.id, name: n, unit, price: String(price), dsu })),
    });
    return c;
  };
  await mkCatalog('Строительные работы', WorkKind.STROY, WORKS_STROY);
  await mkCatalog('Электромонтажные работы', WorkKind.ELEKTRO, WORKS_ELEKTRO);

  console.log(`Seed готов: 3 отдела, 14 пользователей, 5 объектов, маршруты 3×7,`);
  console.log(`работы: ${WORKS_STROY.length} строительных + ${WORKS_ELEKTRO.length} электромонтажных.`);
  console.log('Вход администратора: admin / admin — СМЕНИТЕ пароли после первого входа.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
