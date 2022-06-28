import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Connection, Model } from 'mongoose';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/auth/strategies/jwt/jwt-auth.guard';
import { OptionalJWTGuard } from '../src/auth/strategies/optionalJWT/optionalJWT.guard';
import { Report, ReportSchema } from '../src/report/entities/report.entity';
import { SetDocument } from '../src/set/entities/set.entity';
import { SetModule } from '../src/set/set.module';
import {
    User,
    UserDocument,
    UserSchema
} from '../src/user/entities/user.entity';
import { ReportDocument } from './../src/report/entities/report.entity';
import { FakeAuthGuardFactory } from './helpers/fake-auth-guard.factory';
import {
    closeInMongodConnection,
    rootMongooseTestModule
} from './helpers/mongo-memory-helpers';
import { getMockReports } from './__mocks__/report-mock-data';
import {
    getMockAuthAdmin,
    getMockAuthUser,
    getSetSetupData,
    getUserSetupData
} from './__mocks__/set-mock-data';
import { getJWT, getTestAdmin } from './__mocks__/user-mock-data';

describe('Reports (e2e)', () => {
    let app: INestApplication;
    let setModel: Model<SetDocument>;
    let userModel: Model<UserDocument>;
    let reportModel: Model<ReportDocument>;
    const fakeAuthGuard = new FakeAuthGuardFactory();
    let connection: Connection;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                rootMongooseTestModule(),
                SetModule,
                // User collection only needed for populate functions, no actual code is tested in here
                MongooseModule.forFeature([
                    { name: User.name, schema: UserSchema },
                    { name: Report.name, schema: ReportSchema }
                ])
            ]
        })
            .overrideGuard(JwtAuthGuard)
            .useValue(fakeAuthGuard.getGuard())
            .overrideGuard(OptionalJWTGuard)
            .useValue(fakeAuthGuard.getGuard())
            .compile();

        connection = await module.get(getConnectionToken());
        setModel = connection.model(Set.name);
        userModel = connection.model(User.name);
        reportModel = connection.model(Report.name);
        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
        await app.init();
    });

    beforeEach(async () => {
        await setModel.insertMany(getSetSetupData());
        await userModel.insertMany(getUserSetupData());
        await reportModel.insertMany(getMockReports());
        fakeAuthGuard.setActive(true);
        fakeAuthGuard.setUser(getMockAuthAdmin());
    });

    afterEach(async () => {
        await setModel.deleteMany();
        await userModel.deleteMany();
        fakeAuthGuard.setUser(null);
    });

    afterAll(async () => {
        await connection.close();
        closeInMongodConnection();
    });

    describe('/reports (GET)', () => {
        it('get without specifying status', async () => {
            const res = await request(app.getHttpServer())
                .get('/reports')
                .set(
                    'Authorization',
                    `Bearer ${await getJWT(await getTestAdmin())}`
                )
                .expect(HttpStatus.OK);

            expect(res.body.length).toEqual(getMockReports().length);
        });

        it('get as non admin', async () => {
            fakeAuthGuard.setUser(getMockAuthUser());
            const res = await request(app.getHttpServer())
                .get('/reports')
                .set(
                    'Authorization',
                    `Bearer ${await getJWT(await getMockAuthUser())}`
                )
                .expect(HttpStatus.FORBIDDEN);

            expect(res.body.length).toEqual(getMockReports().length);
        });
    });
});
