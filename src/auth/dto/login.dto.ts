import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({title: "Email", example: "john.doe@example.com"})
  @IsEmail()
  email: string;

  @ApiProperty({title: "Password", example: "JohnDoe@123"})
  @IsString()
  password: string;
}
