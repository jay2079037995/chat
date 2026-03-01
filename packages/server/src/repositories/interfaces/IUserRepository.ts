import type { User, CreateUserDTO } from '@chat/shared';

export interface IUserRepository {
  create(data: CreateUserDTO & { id: string; hashedPassword: string }): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  search(keyword: string): Promise<User[]>;
  getPasswordHash(userId: string): Promise<string | null>;
}
