import { IsNotEmpty, IsOptional, IsString, Length } from "class-validator"
import { Language } from "../../shared/enums/language.enum"

export class CreateSetDto  {
    @IsString()
    @IsNotEmpty()
    @Length(3, 32)
    name: string

    @IsOptional()
    language: Language = Language.DE
}
