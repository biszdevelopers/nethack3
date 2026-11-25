import type { BackchannelService } from "./backchannel-service.js";
import type { BasisAuthClient } from "./basis-auth-client.js";
import type { BearerAuthenticator } from "./bearer-authenticator.js";
import type { LoginService } from "./login-service.js";
import type { SessionService } from "./session-service.js";
import type { TokenService } from "./token-service.js";
import type { UserService } from "./user-service.js";

export interface AuthenticationServices {
    readonly client: BasisAuthClient;
    readonly sessions: SessionService;
    readonly users: UserService;
    readonly login: LoginService;
    readonly tokens: TokenService;
    readonly backchannel: BackchannelService;
    readonly bearer: BearerAuthenticator;
}
