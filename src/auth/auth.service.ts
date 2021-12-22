import {
    ConflictException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
    UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ObjectId } from 'mongoose';
import { User } from '../user/entities/user.entity';
import { UserStatus } from '../user/enums/status.enum';
import { userDataFromProvider } from '../user/interfaces/userDataFromProvider.interface';
import { UserService } from '../user/user.service';
import { AccessTokenDto } from './dto/jwt.dto';
import { RegisterDto } from './dto/register.dto';

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
    async registerUser(credentials: RegisterDto): Promise<AccessTokenDto> {
        // While this might seem unnecessary now, this way of implementing this allows us to add logic to register later without affecting the user create itself
        const user: User = await this.userService.create(credentials);

        /* istanbul ignore next */
        if (!user)
            throw new InternalServerErrorException('User could not be created');

        // Generate and return JWT
        return await this.createLoginPayload(user);
    }

    /**
     * Search for a user by username and validate with the password
     * @param username of the user
     * @param password of the user
     * @returns user without password or if user do not exist returns null
     */
    async validateUserWithEmailPassword(
        email: string,
        password: string
    ): Promise<User> {
        let user: User = null;
        try {
            user = await this.userService.findOneByEmail(email);
        } catch (error) {
            // This is necessary as a not found exception would overwrite the guard response
        }

        // Check if user exists and does not use third party auth
        if (!user || user.provider)
            throw new UnauthorizedException(
                `Login Failed due to invalid credentials`
            );

        // Check if password is correct
        if (!(await bcrypt.compare(password, user.password))) {
            throw new UnauthorizedException(
                `Login Failed due to invalid credentials`
            );
        }

        return user;
    }

    async handleProviderLogin(
        userDataFromProvider: userDataFromProvider
    ): Promise<AccessTokenDto> {
        // This is a failsave that should never occur
        /* istanbul ignore next */
        if (!userDataFromProvider)
            throw new InternalServerErrorException(
                'Request does not have a user. Please contact the administrator'
            );

        let alreadyCreatedUser: User = null;
        try {
            // Check if user already exits
            alreadyCreatedUser = await this.userService.findOneByEmail(
                userDataFromProvider.email
            );
        } catch (error) {
            // Catch not found exception to make user new user is created.
            // If other exceptions occur, throw them
            if (!(error instanceof NotFoundException)) {
                throw error;
            }
        }

        // Check if provider is the same
        if (
            alreadyCreatedUser &&
            alreadyCreatedUser.provider !== userDataFromProvider.provider
        )
            throw new ConflictException(
                `This email is already registered with ${
                    alreadyCreatedUser.provider
                        ? alreadyCreatedUser.provider
                        : 'Email and Password Auth'
                }`
            );

        if (alreadyCreatedUser)
            return this.createLoginPayload(alreadyCreatedUser);

        // Create User
        const newUser: User = await this.userService.createUserFromProvider(
            userDataFromProvider
        );

        // Create Payload and JWT
        return this.createLoginPayload(newUser);
    }

    /**
     * Creates Login Payload and generate JWT with the payload
     * @param user logged in user
     * @returns access token
     */
    createLoginPayload(user: User): AccessTokenDto {
        const payload = {
            username: user.username,
            sub: user._id,
            role: user.role
        };

        return {
            access_token: this.jwtService.sign(payload)
        };
    }

    async isValidJWT(userId: ObjectId): Promise<User | false> {
        let user: User;
        try {
            user = await this.userService.findOneById(userId);
        } catch (error) {
            // This is necessary as a not found exception would overwrite the guard response
            return false;
        }

        /* istanbul ignore next */
        if (!user) return false; // This should never happen but just in case

        if (
            user.status !== UserStatus.ACTIVE &&
            user.status !== UserStatus.UNVERIFIED
        ) {
            // TODO: Add status check once we decided on how to handle reported user
            return false;
        }

        return user;
    }
}
