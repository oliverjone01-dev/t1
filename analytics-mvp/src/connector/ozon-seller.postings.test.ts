// Списки отправлений после отключения /v2/posting/fbo/list (OZON 19.10.2026): v3 FBO и v4 FBS,
// курсорная пагинация, страница 100, sort_dir. Ответ {postings, has_next, cursor}.
import { describe, it, expect, vi, afterEach } from "vitest";
import { OzonSeller } from "./ozon-seller.js";

const resp = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as any;
const body = (fetchMock: any, i: number) => JSON.parse(fetchMock.mock.calls[i][1].body);
const posting = (n: string, price: string | number = "100") => ({
  posting_number: n, status: "delivered", in_process_at: "2026-10-19T10:00:00Z", created_at: "2026-10-19T09:00:00Z",
  products: [{ sku: 1, offer_id: "A", quantity: 2, price }], financial_data: { products: [{ customer_price: 90, quantity: 2 }] },
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("OzonSeller.postings: v3 FBO + v4 FBS с курсором", () => {
  it("зовёт /v3/posting/fbo/list и /v4/posting/fbs/list, страница 100, курсор переносится, цена-строка читается", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resp(200, { postings: [posting("fbo-1")], has_next: true, cursor: "c1" }))
      .mockResolvedValueOnce(resp(200, { postings: [posting("fbo-2", "15.5")], has_next: false, cursor: "" }))
      .mockResolvedValueOnce(resp(200, { postings: [posting("fbs-1")], has_next: false, cursor: "" }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await new OzonSeller({ clientId: "x", apiKey: "y" } as any).postings("2026-02-06", "2026-10-19");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api-seller.ozon.ru/v3/posting/fbo/list");
    expect(fetchMock.mock.calls[2][0]).toBe("https://api-seller.ozon.ru/v4/posting/fbs/list");
    expect(body(fetchMock, 0)).toEqual({
      cursor: "", filter: { since: "2026-02-06T00:00:00.000Z", to: "2026-10-19T23:59:59.999Z" },
      limit: 100, sort_dir: "asc", translit: false, with: { financial_data: true },
    });
    expect(body(fetchMock, 1).cursor).toBe("c1");
    expect(body(fetchMock, 0)).not.toHaveProperty("offset");
    expect(body(fetchMock, 0)).not.toHaveProperty("dir");
    expect(out.map((p) => [p.posting_number, p.src, p.date, p.products[0]!.price])).toEqual([
      ["fbo-1", "FBO", "2026-10-19", 100], ["fbo-2", "FBO", "2026-10-19", 15.5], ["fbs-1", "FBS", "2026-10-19", 100],
    ]);
    expect(out[0]!.financial_data.products[0].customer_price).toBe(90);
  });

  it("has_next без нового курсора - ошибка, а не бесконечный цикл", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(200, { postings: [posting("p")], has_next: true, cursor: "" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new OzonSeller({ clientId: "x", apiKey: "y" } as any).postings("2026-10-01", "2026-10-19")).rejects.toThrow(/без нового курсора/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ответ в обёртке result тоже читается; postingNumbers без financial_data", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resp(200, { result: { postings: [posting("a")], has_next: false } }))
      .mockResolvedValueOnce(resp(200, { result: { postings: [posting("b"), posting("a")], has_next: false } }));
    vi.stubGlobal("fetch", fetchMock);
    const nums = await new OzonSeller({ clientId: "x", apiKey: "y" } as any).postingNumbers("2026-10-01", "2026-10-19");
    expect(nums.sort()).toEqual(["a", "b"]);
    expect(body(fetchMock, 0).with).toEqual({ financial_data: false });
  });

  it("400 obsolete method не повторяется и всплывает с путём", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resp(400, { code: 9, message: "obsolete method cannot be used" })));
    await expect(new OzonSeller({ clientId: "x", apiKey: "y" } as any).postings("2026-10-01", "2026-10-19"))
      .rejects.toThrow(/\/v3\/posting\/fbo\/list -> HTTP 400: .*obsolete/);
  });
});
