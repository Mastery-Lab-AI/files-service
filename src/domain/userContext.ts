export enum UserContextType {
  Student = "student",
  // Parent = "parent",
  // Admin = "admin"
}

export abstract class UserContext {
  readonly tag: UserContextType;
  readonly userId: string;
  readonly accessToken: string;

  protected constructor(tag: UserContextType, userId: string, accessToken: string) {
    this.tag = tag;
    this.userId = userId;
    this.accessToken = accessToken;
  }
}

export class Student extends UserContext {
  constructor(accessToken: string, userId: string) {
    super(UserContextType.Student, userId, accessToken);
  }
}