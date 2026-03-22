import axios from "axios";

const authApi = axios.create({
  baseURL: "http://localhost:4000",
  headers: {
    "Content-Type": "application/json",
  },
});

export type LoginResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  user?: {
    staff_id: number;
    staff_name: string;
    staff_email: string;
    staff_role: string;
    status: string;
    redirect: string;
  };
};

export async function loginUser(
  email: string,
  password: string
): Promise<LoginResponse> {
  const response = await authApi.post("/auth/login", {
    email,
    password,
  });

  return response.data;
}

export function saveLoggedInUser(user: LoginResponse["user"]) {
  localStorage.setItem("authUser", JSON.stringify(user));
}

export function getLoggedInUser() {
  const raw = localStorage.getItem("authUser");
  return raw ? JSON.parse(raw) : null;
}

export function clearLoggedInUser() {
  localStorage.removeItem("authUser");
}