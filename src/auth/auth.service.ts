import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { UserService } from '../user/user.service'
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto'
import * as bcrypt from 'bcrypt'
import { AccessTokenDto, JwtPayloadDto } from './dto/jwt.dto';
import { Provider } from './enums/provider.enum';

@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UserService,
        private readonly jwtService: JwtService
    ) {}
    
    /**
     * Register User (Creates a new one)
     * @param credentials of the user
     * @returns the new registered User
     */
    async registerUser(credentials: RegisterDto): Promise<any> {  
        //While this might seem unnecessary now, this way of implementing this allows us to add logic to register later without affecting the user create itself  
        const user: User = await this.userService.create(credentials)

        if(!user)
            new BadRequestException()

        return this.createLoginPayload(user)
    }

    /**
     * Search for a user by username and validate with the password
     * @param username of the user
     * @param password of the user
     * @returns user without password or if user do not exist returns null 
     */
    async validateUserWithEmailPassword(email: string, password: string): Promise<any> {
        const user = await this.userService.findOneByEmail(email)
        if (user.provider)
            throw new InternalServerErrorException("Google User can't login with Username and Password")

        if (user && await bcrypt.compare(password, user.password)) {
            const { password, ...result } = user
            return result
        }
        return null
    }

    /**
     * Creates Login Payload and generate JWT with the payload
     * @param user logged in user
     * @returns access token 
     */
    async createLoginPayload(user: User): Promise<AccessTokenDto> {
        const payload = { 
            username: user.username,
            sub: user._id
        }

        return {
            access_token: this.jwtService.sign(payload)
        }
    }

    async googleLogin(req): Promise<any> {
        // Should not happen
        if (!req.user)
            throw new InternalServerErrorException("No user found")

        const {
            user
        } = req
        
        // Find user
        const googleuser = await this.userService.findOneByEmail(user.emails[0].value)

        // If user exist create Jwt
        if (googleuser)
            return this.createLoginPayload(user)
        
        // If user does not exist jet create new one
        const newUser = await this.userService.createWithoutPassword(user)
        // Create Jwt
        return this.createLoginPayload(newUser)
    }
}
