"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const uuid_1 = require("uuid");
class UsersService {
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
        return Promise.resolve(Object.assign({ id: (0, uuid_1.v4)(), status: "Happy" }, userCreationParams));
    }
}
exports.UsersService = UsersService;
