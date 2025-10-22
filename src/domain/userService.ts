import {UserContext} from "./userContext";

export class UserService {
  authenticate(accesstoken: string): Promise<UserContext> {

    throw new Error('Not implemented');
  }
}