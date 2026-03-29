import { Controller, Post, Put, Body, Request, UseGuards } from '@nestjs/common';
import { ProfileService } from './mock-platform.service';
import { JwtAuthGuard } from '../Jwt/jwtauth.guard';
import { UpdateUserProfileDto } from './update-user-profile.dto';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Post('platform')
  setPlatform(@Request() req: any, @Body('platform') platform: string) {
    return this.profileService.setPlatform(req.user.userId, platform);
  }

  @Post('platform/connect')
  connectPlatform(@Request() req: any) {
    return this.profileService.connectPlatform(req.user.userId);
  }

  @Post('platform/disconnect')
  disconnectPlatform(@Request() req: any) {
    return this.profileService.disconnectPlatform(req.user.userId);
  }

  @Post('zone')
  setZone(
    @Request() req: any,
    @Body('serviceZone') serviceZone: string,
    @Body('city') city: string,
  ) {
    return this.profileService.setZone(req.user.userId, serviceZone, city);
  }

  @Put('details')
  updateDetails(@Request() req: any, @Body() dto: UpdateUserProfileDto) {
    return this.profileService.updateDetails(req.user.userId, dto);
  }
}
