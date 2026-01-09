import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();
const ORG_ID = Number(process.env.TEST_ORG_ID || 1);

describe("backend smoke tests", () => {
  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ok", true);
  });

  it("GET /metrics/overview returns counts", async () => {
    const res = await request(app).get(`/metrics/overview?org_id=${ORG_ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ok", true);
    expect(res.body).toHaveProperty("data.counts");
  });

  it("GET /event-logs returns items", async () => {
    const res = await request(app).get(`/event-logs?org_id=${ORG_ID}&limit=5`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ok", true);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});
