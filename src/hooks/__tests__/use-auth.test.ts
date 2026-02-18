import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAuth", () => {
  describe("signIn", () => {
    test("returns error result on failure", async () => {
      vi.mocked(signInAction).mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signIn("a@b.com", "wrong");
      });

      expect(returned).toEqual({ success: false, error: "Invalid credentials" });
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("redirects to most recent project on success", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([{ id: "proj-1" }, { id: "proj-2" }] as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass");
      });

      expect(mockPush).toHaveBeenCalledWith("/proj-1");
    });

    test("creates a new project and redirects when no projects exist", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({ id: "new-proj" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/new-proj");
    });

    test("migrates anon work into a new project on success", async () => {
      const anonWork = {
        messages: [{ id: "1", role: "user", content: "Hello" }],
        fileSystemData: { "/App.tsx": { type: "file", content: "export default () => <div />" } },
      };

      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue(anonWork);
      vi.mocked(createProject).mockResolvedValue({ id: "migrated-proj" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/migrated-proj");
      expect(getProjects).not.toHaveBeenCalled();
    });
  });

  describe("signUp", () => {
    test("returns error result on failure", async () => {
      vi.mocked(signUpAction).mockResolvedValue({
        success: false,
        error: "Email already registered",
      });

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signUp("a@b.com", "pass1234");
      });

      expect(returned).toEqual({ success: false, error: "Email already registered" });
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("redirects to most recent project on success", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([{ id: "proj-1" }] as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@b.com", "pass1234");
      });

      expect(mockPush).toHaveBeenCalledWith("/proj-1");
    });

    test("migrates anon work on success", async () => {
      const anonWork = {
        messages: [{ id: "1", role: "user", content: "Build me a button" }],
        fileSystemData: {},
      };

      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue(anonWork);
      vi.mocked(createProject).mockResolvedValue({ id: "migrated-proj" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@b.com", "pass1234");
      });

      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/migrated-proj");
    });
  });

  describe("isLoading", () => {
    test("is false initially", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("is true while signIn is in flight, false after", async () => {
      let resolve!: (v: any) => void;
      vi.mocked(signInAction).mockReturnValue(new Promise((r) => (resolve = r)));

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signIn("a@b.com", "pass");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolve({ success: false, error: "Invalid credentials" });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("is true while signUp is in flight, false after", async () => {
      let resolve!: (v: any) => void;
      vi.mocked(signUpAction).mockReturnValue(new Promise((r) => (resolve = r)));

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signUp("a@b.com", "pass1234");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolve({ success: false, error: "Email already registered" });
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
