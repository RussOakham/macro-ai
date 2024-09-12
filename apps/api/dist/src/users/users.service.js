// src/users/usersService.ts
import { v4 as uuidv4 } from "uuid";
export class UsersService {
    get(id, name) {
        return Promise.resolve({
            id,
            email: "jane@doe.com",
            name: name !== null && name !== void 0 ? name : "Jane Doe",
            status: "Happy",
            phoneNumbers: [],
        });
    }
    create(userCreationParams) {
        return Promise.resolve(Object.assign({ id: uuidv4(), status: "Happy" }, userCreationParams));
    }
}
