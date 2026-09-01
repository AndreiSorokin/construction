import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload { sub: string; role: string; name: string; orgId: string; }

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }
  // payload уже проверен по подписи и сроку; в БД не ходим (быстрая проверка access-токена)
  async validate(payload: JwtPayload) {
    return { id: payload.sub, role: payload.role, name: payload.name, orgId: payload.orgId };
  }
}
