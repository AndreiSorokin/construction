-- убираем параметр ДСУ из списков работ и позиций нарядов
ALTER TABLE "WorkItem" DROP COLUMN "dsu";
ALTER TABLE "OrderLine" DROP COLUMN "dsu";
