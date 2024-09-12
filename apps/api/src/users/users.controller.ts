require("module-alias/register");
import { NextFunction,Request as Req, Response as ExpRes } from "express";
import {
  Body,
  Controller,
  Example,
  Get,
  Middlewares,
  Path,
  Post,
  Query,
  Response,
  Route,
  SuccessResponse,
} from "tsoa";

import { logger as pino } from "@/services/logger";

import { UserCreationParams,UsersService } from "./users.service";
import { User } from "./users.types";

interface ValidateErrorJSON {
  message: "Validation failed";
  details: Record<string, unknown>;
}

const { logger } = pino;

function customMiddleware(req: Req, res: ExpRes, next: NextFunction) {
  // Perform any necessary operations or modifications
  logger.info(`Request: ${req.method} ${req.url}`);
  next();
}

@Route("users")
export class UsersController extends Controller {
  /**
   * Retrieves the details of an existing user.
   * Supply the unique user ID from either and receive corresponding user details.
   * @param userId The user's identifier
   * @param name Provide a username to display
   *
   * @example userId "52907745-7672-470e-a803-a2f8feb52944"
   */
  @Example<User>({
    id: "52907745-7672-470e-a803-a2f8feb52944",
    name: "tsoa user",
    email: "hello@tsoa.com",
    phoneNumbers: [],
    status: "Happy",
  })
  @Get("{userId}")
  @Middlewares(customMiddleware)
  public async getUser(
    @Path() userId: string,
    @Query() name?: string
  ): Promise<User> {
    return new UsersService().get(userId, name);
  }

  /**
   * Add a new user. Remember that the demo API will not persist this data.
   *
   */
  @Response<ValidateErrorJSON>(422, "Validation Failed", {
    message: "Validation failed",
    details: {
      requestBody: {
        message: "id is an excess property and therefore not allowed",
        value: "52907745-7672-470e-a803-a2f8feb52944",
      },
    },
  })
  @SuccessResponse("201", "Created") // Custom success response
  @Post()
  @Middlewares(customMiddleware)
  public async createUser(
    @Body() requestBody: UserCreationParams
  ): Promise<void> {
    this.setStatus(201); // set return status 201
    await new UsersService().create(requestBody);
    return;
  }
}
