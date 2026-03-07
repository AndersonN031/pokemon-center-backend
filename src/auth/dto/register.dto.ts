import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsStrongPassword, MinLength } from 'class-validator';
import { INVALID_CREDENTIALS, SPECIAL_CHARACTERS } from '../auth.constants';

export class RegisterDto {
  @ApiProperty({title: "Name", example: "John Doe"})
  @IsString()
  name: string;

  @ApiProperty({title: "Email", example: "john.doe@example.com"})
  @IsEmail()
  email: string;

  @ApiProperty({title: "Password", example: "JohnDoe@123"})
  @IsStrongPassword(
		{
			minLength: 6,
			minLowercase: 1,
			minUppercase: 1,
			minNumbers: 1,
			minSymbols: 1,
		},
		{ message: SPECIAL_CHARACTERS },
	)
	password: string;
}
