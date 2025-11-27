export interface SignupRequest {
  email: string;
  password: string;
}

export interface SignupResponse {
  message: string;
  user_id: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthError {
  detail: string;
}

export interface DecodedToken {
  sub: string;
  role: string;
  exp: number;
}