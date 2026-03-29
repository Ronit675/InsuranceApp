export class UpdateUserProfileDto {
  fullName!: string;
  dateOfBirth!: string;
  address!: string;
  email!: string;
  profilePhoto?: string | null;
}
