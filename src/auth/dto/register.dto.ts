import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';
import { INVALID_CREDENTIALS, SPECIAL_CHARACTERS } from '../auth.constants';

export class RegisterDto {
  @ApiProperty({ title: 'Name', example: 'John Doe' })
  @IsString()
  @MinLength(2, { message: 'Minimo 2 caracteres' })
  @MaxLength(100, { message: 'Máximo 100 caracteres' })
  name: string;

  @ApiProperty({ title: 'Email', example: 'john.doe@example.com' })
  @IsEmail()
  @MaxLength(254, {message: "Máximo 254 caracteres"})
  email: string;

  @ApiProperty({ title: 'Password', example: 'JohnDoe@123' })
   @MaxLength(128, {message: "Máximo 128 caracteres"})
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
