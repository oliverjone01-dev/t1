// Откуда взята контрольная сторона. Отдельный модуль, потому что 24.09 ФЕНИКС поймал здесь
// ложь в подписи: явный список участников акции из tests.json страница называла «панелью
// снимка без тестовых и их родни». Величина была верной, происхождение нет, а это тот же
// класс ошибки: читатель судит о числе по тому, откуда оно взялось.
//
// Правило вынесено из сборщика сюда, чтобы на него можно было написать тест: build-tests.ts
// исполняет код на верхнем уровне и в тест не импортируется.

export type CtlSrc = "funnel_arts" | "funnel_agg" | "explicit" | "panel";

export const CTL_SRC_NAME: Record<CtlSrc, string> = {
  funnel_arts: "контрольные артикулы из funnel_tests",
  funnel_agg: "готовый агрегат из funnel_tests",
  explicit: "явный список участников той же акции из tests.json",
  panel: "панель снимка без тестовых и их родни",
};

export interface CtlAvail {
  /** Метрика приходит из funnel_tests (воронка), а не из наших рядов. */
  funnelMetric: boolean;
  /** Файл funnel_tests есть. */
  funnelFile: boolean;
  /** В файле есть строки с ролью control. */
  funnelArts: number;
  /** В файле есть агрегаты по этому тесту. */
  funnelAgg: boolean;
  /** В tests.json контроль задан группой целиком, а не парами. */
  explicit: boolean;
}

/** Приоритет источников. Порядок от точного к грубому: поартикульные строки среза под тесты,
 *  готовый агрегат, явный список из tests.json, панель снимка. */
export function pickCtlSrc(a: CtlAvail): CtlSrc {
  if (a.funnelMetric && a.funnelFile) {
    if (a.funnelArts > 0) return "funnel_arts";
    if (a.funnelAgg) return "funnel_agg";
  }
  return a.explicit ? "explicit" : "panel";
}
