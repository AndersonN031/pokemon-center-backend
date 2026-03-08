import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @MinLength(2, {message: 'Minimo 2 caracteres'})
  @MaxLength(100, {message: "Máximo 100 caracteres"})
  name: string;

  @IsEmail()
  @MaxLength(254, {message:"Máximo 254 caracteres"})
  email: string;

  @MinLength(6, {message: "Minimo 6 caracteres"})
   @MaxLength(128, {message: "Máximo 128 caracteres"})
  password: string;
}