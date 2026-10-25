export interface Student {
  id: string;
  email: string;
  address: string;
  confirmed: boolean;
}

export interface Credentials {
  password: string;
}

export interface SessionToken {
  accessToken: string;
  refreshToken: string;
}
