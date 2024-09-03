// src/users/usersService.ts
import { User } from "./users.types";
import { v4 as uuidv4 } from "uuid";

// A post request should not contain an id.
export type UserCreationParams = Pick<User, "email" | "name" | "phoneNumbers">;

export class UsersService {
  public get(id: string, name?: string): Promise<User> {
    return Promise.resolve({
      id,
      email: "jane@doe.com",
      name: name ?? "Jane Doe",
      status: "Happy",
      phoneNumbers: [],
    });
  }

  public create(userCreationParams: UserCreationParams): Promise<User> {
    return Promise.resolve({
      id: uuidv4(), // Random
      status: "Happy",
      ...userCreationParams,
    });
  }
}
