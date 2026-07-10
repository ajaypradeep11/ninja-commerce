import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddressDto } from './dto/update-addresses.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  ensureUser(uid: string, email: string): Promise<User> {
    return this.prisma.user.upsert({
      where: { id: uid },
      create: { id: uid, email },
      update: { email },
    });
  }

  getMe(uid: string, email: string): Promise<User> {
    return this.ensureUser(uid, email);
  }

  async updateAddresses(
    uid: string,
    email: string,
    addresses: AddressDto[],
  ): Promise<User> {
    await this.ensureUser(uid, email);
    return this.prisma.user.update({
      where: { id: uid },
      data: { addresses: addresses as unknown as object[] },
    });
  }
}
