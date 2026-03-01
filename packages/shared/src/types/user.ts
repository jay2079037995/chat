export interface User {
  id: string;
  username: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateUserDTO {
  username: string;
  password: string;
}

export interface LoginDTO {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
