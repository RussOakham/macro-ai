"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
require("module-alias/register");
const tsoa_1 = require("tsoa");
const users_service_1 = require("./users.service");
const logger_1 = require("@/services/logger");
const { logger } = logger_1.logger;
function customMiddleware(req, res, next) {
    // Perform any necessary operations or modifications
    logger.info(`Request: ${req.method} ${req.url}`);
    next();
}
let UsersController = class UsersController extends tsoa_1.Controller {
    /**
     * Retrieves the details of an existing user.
     * Supply the unique user ID from either and receive corresponding user details.
     * @param userId The user's identifier
     * @param name Provide a username to display
     *
     * @example userId "52907745-7672-470e-a803-a2f8feb52944"
     */
    getUser(userId, name) {
        return __awaiter(this, void 0, void 0, function* () {
            return new users_service_1.UsersService().get(userId, name);
        });
    }
    /**
     * Add a new user. Remember that the demo API will not persist this data.
     *
     */
    createUser(requestBody) {
        return __awaiter(this, void 0, void 0, function* () {
            this.setStatus(201); // set return status 201
            yield new users_service_1.UsersService().create(requestBody);
            return;
        });
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, tsoa_1.Example)({
        id: "52907745-7672-470e-a803-a2f8feb52944",
        name: "tsoa user",
        email: "hello@tsoa.com",
        phoneNumbers: [],
        status: "Happy",
    }),
    (0, tsoa_1.Get)("{userId}"),
    (0, tsoa_1.Middlewares)(customMiddleware),
    __param(0, (0, tsoa_1.Path)()),
    __param(1, (0, tsoa_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getUser", null);
__decorate([
    (0, tsoa_1.Response)(422, "Validation Failed", {
        message: "Validation failed",
        details: {
            requestBody: {
                message: "id is an excess property and therefore not allowed",
                value: "52907745-7672-470e-a803-a2f8feb52944",
            },
        },
    }),
    (0, tsoa_1.SuccessResponse)("201", "Created") // Custom success response
    ,
    (0, tsoa_1.Post)(),
    (0, tsoa_1.Middlewares)(customMiddleware),
    __param(0, (0, tsoa_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "createUser", null);
exports.UsersController = UsersController = __decorate([
    (0, tsoa_1.Route)("users")
], UsersController);
