// supabase/functions/_shared/http.test.ts
import { describe, it, expect } from "vitest";
import { handleOptions, jsonResponse, jsonError, validateRequest } from "./http.ts";

describe("http helpers", () => {
  describe("handleOptions", () => {
    it("should return a CORS response for OPTIONS requests", () => {
      const req = new Request("http://example.com", { method: "OPTIONS" });
      const res = handleOptions(req);
      expect(res).toBeInstanceOf(Response);
      expect(res!.status).toBe(200);
      expect(res!.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("should return null for non-OPTIONS requests", () => {
      const req = new Request("http://example.com", { method: "GET" });
      const res = handleOptions(req);
      expect(res).toBeNull();
    });
  });

  describe("jsonResponse", () => {
    it("should create a valid JSON response", async () => {
      const data = { a: 1, b: "test" };
      const res = jsonResponse(data, 201);
      expect(res.status).toBe(201);
      expect(res.headers.get("Content-Type")).toBe("application/json");
      expect(await res.json()).toEqual(data);
    });
  });

  describe("jsonError", () => {
    it("should create a structured JSON error response", async () => {
      const res = jsonError("Not Found", 404, "NOT_FOUND");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        ok: false,
        error: "Not Found",
        code: "NOT_FOUND",
      });
    });
  });

  describe("validateRequest", () => {
    it("should parse a valid request body", async () => {
      const req = new Request("http://example.com", {
        method: "POST",
        body: JSON.stringify({ name: "Jules", age: 30 }),
      });
      const parser = (body: any) => ({ name: body.name, age: body.age });
      const { data, errorResponse } = await validateRequest(req, parser);
      expect(errorResponse).toBeNull();
      expect(data).toEqual({ name: "Jules", age: 30 });
    });

    it("should return an error for invalid JSON", async () => {
      const req = new Request("http://example.com", {
        method: "POST",
        body: "{ not: json }",
      });
      const parser = (body: any) => body;
      const { data, errorResponse } = await validateRequest(req, parser);
      expect(data).toBeNull();
      expect(errorResponse).toBeInstanceOf(Response);
      expect(errorResponse!.status).toBe(400);
    });

    it("should return an error for a failed parser validation", async () => {
      const req = new Request("http://example.com", {
        method: "POST",
        body: JSON.stringify({ name: "Jules" }),
      });
      const parser = (body: any) => {
        if (!body.age) throw new Error("Age is required");
        return body;
      };
      const { data, errorResponse } = await validateRequest(req, parser);
      expect(data).toBeNull();
      expect(errorResponse).toBeInstanceOf(Response);
      expect(errorResponse!.status).toBe(400);
    });
  });
});
