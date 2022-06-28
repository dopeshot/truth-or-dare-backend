import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Connection, Model } from 'mongoose';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/auth/strategies/jwt/jwt-auth.guard';
import { OptionalJWTGuard } from '../src/auth/strategies/optionalJWT/optionalJWT.guard';
import { SetDocument } from '../src/set/entities/set.entity';
import { SetCategory } from '../src/set/enums/setcategory.enum';
import { TaskType } from '../src/set/enums/tasktype.enum';
import { Visibility } from '../src/set/enums/visibility.enum';
import {
    SetMetadataResponse,
    SetResponse,
    SetWithTasksResponse,
    TaskResponse,
    UpdatedCounts
} from '../src/set/responses/set-response';
import { SetModule } from '../src/set/set.module';
import { Language } from '../src/shared/enums/language.enum';
import { Status } from '../src/shared/enums/status.enum';
import { getString } from '../src/shared/global-functions/get-string';
import { UserDocument, UserSchema } from '../src/user/entities/user.entity';
import { FakeAuthGuardFactory } from './helpers/fake-auth-guard.factory';
import {
    closeInMongodConnection,
    rootMongooseTestModule
} from './helpers/mongo-memory-helpers';
import {
    getMockAuthAdmin,
    getMockAuthUser,
    getMockFullSet,
    getMockSet,
    getMockTask,
    getOtherMockAuthUser,
    getSetSetupData,
    getUserSetupData,
    getWrongId
} from './__mocks__/set-mock-data';

describe('Sets (e2e)', () => {
    let app: INestApplication;
    let setModel: Model<SetDocument>;
    let userModel: Model<UserDocument>;
    const fakeAuthGuard = new FakeAuthGuardFactory();
    let connection: Connection;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                rootMongooseTestModule(),
                SetModule,
                // User collection only needed for populate functions, no actual code is tested in here
                MongooseModule.forFeature([
                    { name: 'User', schema: UserSchema }
                ])
            ]
        })
            .overrideGuard(JwtAuthGuard)
            .useValue(fakeAuthGuard.getGuard())
            .overrideGuard(OptionalJWTGuard)
            .useValue(fakeAuthGuard.getGuard())
            .compile();

        connection = await module.get(getConnectionToken());
        setModel = connection.model('Set');
        userModel = connection.model('User');
        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
        await app.init();
    });

    beforeEach(async () => {
        await setModel.insertMany(getSetSetupData());
        await userModel.insertMany(getUserSetupData());
        fakeAuthGuard.setActive(true);
        fakeAuthGuard.setUser(getMockAuthUser());
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

    describe('Set POST', () => {
        it('/sets (POST) one public set', async () => {
            const res = await request(app.getHttpServer())
                .post('/sets')
                .send(getMockSet())
                .expect(HttpStatus.CREATED);
            expect((await setModel.find()).length).toBe(
                getSetSetupData().length + 1
            );

            // Testing class SetResponse
            const set = new SetResponse(res.body);
            expect(res.body).toMatchObject(set);
        });

        it('/sets (POST) one private set', async () => {
            const res = await request(app.getHttpServer())
                .post('/sets')
                .send({ ...getMockSet(), visibility: Visibility.PRIVATE })
                .expect(HttpStatus.CREATED);
            expect((await setModel.find()).length).toBe(
                getSetSetupData().length + 1
            );

            // Testing class SetResponse omitted due to above test

            expect((await setModel.findById(res.body._id)).visibility).toBe(
                Visibility.PRIVATE
            );
        });

        it('/sets/createfullset (POST) one set', async () => {
            fakeAuthGuard.setUser(getMockAuthAdmin());
            const mockSet = getMockFullSet();
            const res = await request(app.getHttpServer())
                .post('/sets/createfullset')
                .send(mockSet)
                .expect(HttpStatus.CREATED);

            // Testing contents
            expect(res.body.name).toEqual(mockSet.name);
            expect(res.body.language).toEqual(mockSet.language);
            expect(res.body.category).toEqual(mockSet.category);
            expect(res.body.visibility).toEqual(mockSet.visibility);
            expect(res.body.tasks.length).toBe(mockSet.tasks.length);

            // Testing class SetWithTasksResponse
            const set = new SetWithTasksResponse(res.body);
            expect(res.body).toMatchObject(set);
        });

        // Negative test
        it('/sets/createfullset (POST) one set by non admin', async () => {
            await request(app.getHttpServer())
                .post('/sets/createfullset')
                .send(getMockFullSet())
                .expect(HttpStatus.FORBIDDEN);
        });

        // Negative test
        it('/sets/createfullset (POST) one set without tasks', async () => {
            const mockSet = getMockFullSet();
            const { tasks, ...tasklessMockSet } = mockSet;
            await request(app.getHttpServer())
                .post('/sets/createfullset')
                .send(tasklessMockSet)
                .expect(HttpStatus.BAD_REQUEST);
        });

        // Negative test
        it('/sets (POST) wrong visibility', async () => {
            await request(app.getHttpServer())
                .post('/sets')
                .send({ ...getMockSet(), visibility: 'Some jibberish' })
                .expect(HttpStatus.BAD_REQUEST);
        });

        // Negative test
        it('/sets (POST) without auth', async () => {
            fakeAuthGuard.setActive(false);
            await request(app.getHttpServer())
                .post('/sets')
                .send(getMockSet())
                .expect(HttpStatus.FORBIDDEN);
        });

        // Negative test
        it('/sets (POST) wrong language', async () => {
            await request(app.getHttpServer())
                .post('/sets')
                .send({ language: 'wrong', name: "Doesn't matter" })
                .expect(HttpStatus.BAD_REQUEST);
        });

        // Negative test
        it('/sets (POST) with too short name', async () => {
            await request(app.getHttpServer())
                .post('/sets')
                .send({ language: Language.DE, name: getString(2) })
                .expect(HttpStatus.BAD_REQUEST);
        });

        // Negative test
        it('/sets (POST) with too long name', async () => {
            await request(app.getHttpServer())
                .post('/sets')
                .send({
                    language: Language.DE,
                    name: getString(33)
                })
                .expect(HttpStatus.BAD_REQUEST);
        });

        // Negative test
        it('/sets (POST) with no name', async () => {
            await request(app.getHttpServer())
                .post('/sets')
                .send({ language: Language.DE })
                .expect(HttpStatus.BAD_REQUEST);
        });

        // Negative test
        it('/sets (POST) with number name', async () => {
            await request(app.getHttpServer())
                .post('/sets')
                .send({ language: Language.DE, name: 2 })
                .expect(HttpStatus.BAD_REQUEST);
        });
    });

    describe('Set GET', () => {
        it('/sets (GET) all sets', async () => {
            const res = await request(app.getHttpServer())
                .get('/sets')
                .expect(HttpStatus.OK);
            const sets = res.body;
            expect(sets.length === 1).toBeTruthy();

            // Testing class SetResponse
            const set = new SetResponse(res.body);
            expect(res.body).toMatchObject(set);
        });

        it('/sets?lang=en (GET) all sets in english ', async () => {
            const res = await request(app.getHttpServer())
                .get('/sets?lang=en')
                .expect(HttpStatus.OK);
            const sets = res.body;
            expect(sets.length).toBe(0);
        });

        it('/sets?lang=de (GET) all sets in deutsch ', async () => {
            const res = await request(app.getHttpServer())
                .get('/sets?lang=de')
                .expect(HttpStatus.OK);
            const sets = res.body;
            expect(sets.length === 1).toBeTruthy();
            expect(sets[0].language).toBe(Language.DE);
            // Testing class SetResponse
            const set = new SetResponse(res.body);
            expect(res.body).toMatchObject(set);
        });

        it('/sets/:id (GET) by id without auth', async () => {
            fakeAuthGuard.setUser(null);
            const res = await request(app.getHttpServer())
                .get(`/sets/${getSetSetupData()[0]._id}`)
                .expect(HttpStatus.OK);

            // Testing class SetResponse
            const set = new SetResponse(res.body);
            expect(res.body).toMatchObject(set);

            // Testing class TaskResponse
            const task = new TaskResponse(res.body.tasks[0]);
            expect(res.body.tasks[0]).toMatchObject(task);

            // Testing content
            // Adding property status since it is in the SetupData
            res.body.tasks[0]['status'] = Status.ACTIVE;
            expect({
                ...set,
                createdBy: getSetSetupData()[0].createdBy,
                status: getSetSetupData()[0].status,
                visibility: getSetSetupData()[0].visibility
            }).toEqual({ ...getSetSetupData()[0] });
        });

        it('/sets/:id (GET) private by id with auth owner', async () => {
            const res = await request(app.getHttpServer())
                .get(`/sets/${getSetSetupData()[1]._id}`)
                .expect(HttpStatus.OK);
            expect(res.body.visibility).toBe(Visibility.PRIVATE);
            expect(res.body.createdBy._id).toBe(getMockAuthUser().userId);
        });

        it('/sets/:id (GET) private by id with auth admin', async () => {
            fakeAuthGuard.setUser(getMockAuthAdmin());
            const res = await request(app.getHttpServer())
                .get(`/sets/${getSetSetupData()[1]._id}`)
                .expect(HttpStatus.OK);
            expect(res.body.visibility).toBe(Visibility.PRIVATE);
        });

        it('/sets/user/:id (GET) usersets without auth', async () => {
            fakeAuthGuard.setUser(null);
            const res = await request(app.getHttpServer())
                .get(`/sets/user/${getMockAuthUser().userId}`)
                .expect(HttpStatus.OK);
            const sets = res.body;
            expect(sets.length).toBe(1);

            // Testing class SetResponse omitted due to above test
        });

        it('/sets/user/:id (GET) usersets by self', async () => {
            const res = await request(app.getHttpServer())
                .get(`/sets/user/${getMockAuthUser().userId}`)
                .expect(HttpStatus.OK);
            const sets = res.body;
            expect(sets.length).toBe(2);

            // Testing class SetResponse omitted due to above test
        });

        it('/sets/user/:id (GET) usersets by other user', async () => {
            fakeAuthGuard.setUser(getOtherMockAuthUser());
            const res = await request(app.getHttpServer())
                .get(`/sets/user/${getMockAuthUser().userId}`)
                .expect(HttpStatus.OK);
            const sets = res.body;
            expect(sets.length).toBe(1);

            // Testing class SetResponse omitted due to above test
        });

        it('/sets/user/:id (GET) usersets by admin', async () => {
            fakeAuthGuard.setUser(getMockAuthAdmin());
            const res = await request(app.getHttpServer())
                .get(`/sets/user/${getMockAuthUser().userId}`)
                .expect(HttpStatus.OK);
            const sets = res.body;
            expect(sets.length).toBe(2);

            // Testing class SetResponse omitted due to above test
        });

        // Negative test
        it('/sets?lang=ef (GET) all sets in wrong language ', async () => {
            await request(app.getHttpServer())
                .get('/sets/lang=ef')
                .expect(HttpStatus.BAD_REQUEST);
        });

        // Negative test
        it('/sets/:id (GET) private by id with wrong user', async () => {
            fakeAuthGuard.setUser(getOtherMockAuthUser());
            await request(app.getHttpServer())
                .get(`/sets/${getSetSetupData()[1]._id}`)
                .expect(HttpStatus.NOT_FOUND);
        });

        // Negative test
        it('/sets/:id (GET) deleted set by id', async () => {
            await request(app.getHttpServer())
                .get(`/sets/${getSetSetupData()[2]._id}`)
                .expect(HttpStatus.NOT_FOUND);
        });

        // Negative test
        it('/sets/:id (GET) by wrong id', async () => {
            await request(app.getHttpServer())
                .get(`/sets/${getWrongId()}`)
                .expect(HttpStatus.NOT_FOUND);
        });
    });

    describe('Set PATCH', () => {
        it('/sets/:id (PATCH) by id by user (language)', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/sets/${getSetSetupData()[0]._id}`)
                .send({ language: Language.DE })
                .expect(HttpStatus.OK);

            const set = res.body;

            expect(set.visibility).toBe(getSetSetupData()[0].visibility);
            expect(set.language).toEqual(Language.DE);
            expect(set.category).toBe(getSetSetupData()[0].category);
            expect(set.name).toBe(getSetSetupData()[0].name);

            // Check if database got changed correctly too
            const setDB = await setModel.findById(getSetSetupData()[0]._id);
            expect(setDB.visibility).toBe(getSetSetupData()[0].visibility);
            expect(setDB.language).toEqual(Language.DE);
            expect(setDB.category).toBe(getSetSetupData()[0].category);
            expect(setDB.name).toBe(getSetSetupData()[0].name);

            // Testing class SetMetadataResponse
            const setClass = new SetMetadataResponse(set);
            expect(set).toMatchObject(setClass);
        });

        it('/sets/:id (PATCH) by id by user (name)', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/sets/${getSetSetupData()[0]._id}`)
                .send({ name: 'New name' })
                .expect(HttpStatus.OK);

            const set = res.body;

            expect(set.visibility).toBe(getSetSetupData()[0].visibility);
            expect(set.language).toEqual(getSetSetupData()[0].language);
            expect(set.category).toBe(getSetSetupData()[0].category);
            expect(set.name).toBe('New name');

            // Check if database got changed correctly too
            const setDB = await setModel.findById(getSetSetupData()[0]._id);
            expect(setDB.visibility).toBe(getSetSetupData()[0].visibility);
            expect(setDB.language).toEqual(getSetSetupData()[0].language);
            expect(setDB.category).toBe(getSetSetupData()[0].category);
            expect(setDB.name).toBe('New name');

            // Testing class ResponseSetMetadata omitted due to above test
        });

        it('/sets/:id (PATCH) by id by user (category)', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/sets/${getSetSetupData()[0]._id}`)
                .send({ category: SetCategory.CRAZY })
                .expect(HttpStatus.OK);

            const set = res.body;

            expect(set.visibility).toBe(getSetSetupData()[0].visibility);
            expect(set.language).toEqual(getSetSetupData()[0].language);
            expect(set.category).toBe(SetCategory.CRAZY);
            expect(set.name).toBe(getSetSetupData()[0].name);

            // Check if database got changed correctly too
            const setDB = await setModel.findById(getSetSetupData()[0]._id);
            expect(setDB.visibility).toBe(getSetSetupData()[0].visibility);
            expect(setDB.language).toEqual(getSetSetupData()[0].language);
            expect(setDB.category).toBe(SetCategory.CRAZY);
            expect(setDB.name).toBe(getSetSetupData()[0].name);

            // Testing class SetMetadataResponse omitted due to above test
        });

        it('/sets/:id (PATCH) by id by user (visibility)', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/sets/${getSetSetupData()[0]._id}`)
                .send({ visibility: Visibility.PRIVATE })
                .expect(HttpStatus.OK);

            const set = res.body;

            expect(set.visibility).toBe(Visibility.PRIVATE);
            expect(set.language).toEqual(getSetSetupData()[0].language);
            expect(set.category).toBe(getSetSetupData()[0].category);
            expect(set.name).toBe(getSetSetupData()[0].name);

            // Check if database got changed correctly too
            const setDB = await setModel.findById(getSetSetupData()[0]._id);
            expect(setDB.visibility).toBe(Visibility.PRIVATE);
            expect(setDB.language).toEqual(getSetSetupData()[0].language);
            expect(setDB.category).toBe(getSetSetupData()[0].category);
            expect(setDB.name).toBe(getSetSetupData()[0].name);

            // Testing class ResponseSetMetadata omitted due to above test
        });

        it('/sets/:id (PATCH) by id by admin', async () => {
            fakeAuthGuard.setUser(getMockAuthAdmin());
            const res = await request(app.getHttpServer())
                .patch(`/sets/${getSetSetupData()[0]._id}`)
                .send({ language: Language.DE })
                .expect(HttpStatus.OK);
            expect(res.body.language).toEqual(Language.DE);

            // Testing class ResponseSetMetadata omitted due to above test
        });

        it('/sets/:id/played (PATCH) played', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/sets/${getSetSetupData()[0]._id}/played`)
                .expect(HttpStatus.OK);
            expect(res.body.played).toBe(1);
        });

        // Negative test
        it('/sets/:id (PATCH) by id by user with wrong language', async () => {
            await request(app.getHttpServer())
                .patch(`/sets/${getSetSetupData()[0]._id}`)
                .send({ language: 'Some string' })
                .expect(HttpStatus.BAD_REQUEST);
        });

        // Negative test
        it('/sets/:id (PATCH) by id by user with wrong param', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/sets/${getSetSetupData()[0]._id}`)
                .send({ somethingWrong: 'Some string' })
                .expect(HttpStatus.OK);
            expect(res.body.somethingWrong).toBeUndefined();
        });

        // Negative test
        it('/sets/:id (PATCH) by id by wrong user', async () => {
            fakeAuthGuard.setUser({
                ...getMockAuthUser(),
                userId: getWrongId()
            });
            await request(app.getHttpServer())
                .patch(`/sets/${getSetSetupData()[0]._id}`)
                .send({ language: Language.DE })
                .expect(HttpStatus.NOT_FOUND);
        });

        // Negative test
        it('/sets/:id (PATCH) by wrong id', async () => {
            fakeAuthGuard.setUser(getMockAuthAdmin());
            await request(app.getHttpServer())
                .patch(`/sets/${getWrongId()}`)
                .send({ language: Language.DE })
                .expect(HttpStatus.NOT_FOUND);
        });

        // Negative test
        it('/sets/:id (PATCH) by wrong id by admin', async () => {
            fakeAuthGuard.setUser(getMockAuthAdmin());
            const res = await request(app.getHttpServer())
                .patch(`/sets/${getWrongId()}/played`)
                .expect(HttpStatus.NOT_FOUND);
        });

        // Negative test
        it('/sets/:id (PATCH) by no user', async () => {
            fakeAuthGuard.setActive(false);
            await request(app.getHttpServer())
                .patch(`/sets/${getWrongId()}`)
                .send({ language: Language.DE })
                .expect(HttpStatus.FORBIDDEN);
        });
    });

    describe('Set DELETE', () => {
        it('/sets/:id (DELETE) by id by user', async () => {
            await request(app.getHttpServer())
                .delete(`/sets/${getSetSetupData()[0]._id}`)
                .expect(HttpStatus.NO_CONTENT);
            expect(
                (await setModel.findById(getSetSetupData()[0]._id)).status
            ).toEqual(Status.DELETED);
        });

        it('/sets/:id (DELETE) by id by admin', async () => {
            fakeAuthGuard.setUser(getMockAuthAdmin());
            await request(app.getHttpServer())
                .delete(`/sets/${getSetSetupData()[0]._id}`)
                .expect(HttpStatus.NO_CONTENT);
            expect(
                (await setModel.findById(getSetSetupData()[0]._id)).status
            ).toEqual(Status.DELETED);
        });

        it('/sets/:id (DELETE) by id with hard delete by admin', async () => {
            fakeAuthGuard.setUser(getMockAuthAdmin());
            await request(app.getHttpServer())
                .delete(`/sets/${getSetSetupData()[0]._id}?type=hard`)
                .expect(HttpStatus.NO_CONTENT);
            expect((await setModel.find()).length).toBe(
                getSetSetupData().length - 1
            );
        });

        // Negative test
        it('/sets/:id (DELETE) by id by wrong user', async () => {
            fakeAuthGuard.setUser({
                ...getMockAuthUser(),
                userId: getWrongId()
            });
            await request(app.getHttpServer())
                .delete(`/sets/${getSetSetupData()[0]._id}`)
                .expect(HttpStatus.NOT_FOUND);
        });

        // Negative test
        it('/sets/:id (DELETE) by wrong id', async () => {
            await request(app.getHttpServer())
                .delete(`/sets/${getWrongId()}`)
                .expect(HttpStatus.NOT_FOUND);
        });

        // Negative test
        it('/sets/:id (DELETE) by wrong id with hard delete by admin', async () => {
            fakeAuthGuard.setUser(getMockAuthAdmin());
            await request(app.getHttpServer())
                .delete(`/sets/${getWrongId()}?type=hard`)
                .expect(HttpStatus.NOT_FOUND);
        });

        // Negative test
        it('/sets/:id (DELETE) by id with hard delete by user', async () => {
            await request(app.getHttpServer())
                .delete(`/sets/${getSetSetupData()[0]._id}?type=hard`)
                .expect(HttpStatus.FORBIDDEN);
        });
    });

    describe('Task POST', () => {
        it('/sets/:id/task (POST)', async () => {
            const res = await request(app.getHttpServer())
                .post(`/sets/${getSetSetupData()[0]._id}/task`)
                .send(getMockTask())
                .expect(HttpStatus.CREATED);
            const set = await setModel.findById(getSetSetupData()[0]._id);
            expect(set.tasks.length).toBe(2);
            expect(set.truthCount).toBe(2);

            // Testing class TaskResponse
            const task = new TaskResponse(res.body);
            expect(res.body).toMatchObject(task);
        });

        it('/sets/:id/task (POST) without CurrentPlayerGender', async () => {
            const { currentPlayerGender, ...obj } = getMockTask();
            const res = await request(app.getHttpServer())
                .post(`/sets/${getSetSetupData()[0]._id}/task`)
                .send(obj)
                .expect(HttpStatus.CREATED);
            expect(
                (await setModel.findById(getSetSetupData()[0]._id)).tasks.length
            ).toBe(2);

            // Testing class TaskResponse
            const task = new TaskResponse(res.body);
            expect(res.body).toMatchObject(task);
        });

        it('/sets/:id/task (POST) with extra parameter', async () => {
            const res = await request(app.getHttpServer())
                .post(`/sets/${getSetSetupData()[0]._id}/task`)
                .send({ ...getMockTask(), more: 'Some more' })
                .expect(HttpStatus.CREATED);
            expect(
                (await setModel.findById(getSetSetupData()[0]._id)).tasks.length
            ).toBe(2);

            // Testing class TaskResponse
            const task = new TaskResponse(res.body);
            expect(res.body).toMatchObject(task);
        });

        // Negative test
        it('/sets/:id/task (POST) with wrong setId', async () => {
            await request(app.getHttpServer())
                .post(`/sets/${getWrongId()}/task`)
                .send(getMockTask())
                .expect(HttpStatus.NOT_FOUND);
        });

        // Negative test
        it('/sets/:id/task (POST) with wrong TaskType', async () => {
            await request(app.getHttpServer())
                .post(`/sets/${getSetSetupData()[0]._id}/task`)
                .send({ ...getMockTask(), type: 'wrong' })
                .expect(HttpStatus.BAD_REQUEST);
        });

        // Negative test
        it('/sets/:id/task (POST) with wrong CurrentPlayerGender', async () => {
            await request(app.getHttpServer())
                .post(`/sets/${getSetSetupData()[0]._id}/task`)
                .send({ ...getMockTask(), currentPlayerGender: 'wrong' })
                .expect(HttpStatus.BAD_REQUEST);
        });

        // Negative test
        it('/sets/:id/task (POST) with too short message', async () => {
            await request(app.getHttpServer())
                .post(`/sets/${getSetSetupData()[0]._id}/task`)
                .send({ ...getMockTask(), message: getString(9) })
                .expect(HttpStatus.BAD_REQUEST);
        });

        // Negative test
        it('/sets/:id/task (POST) with too long message', async () => {
            await request(app.getHttpServer())
                .post(`/sets/${getSetSetupData()[0]._id}/task`)
                .send({ ...getMockTask(), message: getString(281) })
                .expect(HttpStatus.BAD_REQUEST);
        });

        // Negative test
        it('/sets/:id/task (POST) without type', async () => {
            const { type, ...obj } = getMockTask();
            await request(app.getHttpServer())
                .post(`/sets/${getSetSetupData()[0]._id}/task`)
                .send(obj)
                .expect(HttpStatus.BAD_REQUEST);
        });

        // Negative test
        it('/sets/:id/task (POST) without message', async () => {
            const { message, ...obj } = getMockTask();
            await request(app.getHttpServer())
                .post(`/sets/${getSetSetupData()[0]._id}/task`)
                .send(obj)
                .expect(HttpStatus.BAD_REQUEST);
        });
    });

    describe('Task PUT', () => {
        it('/sets/:id/task (PUT) changing type for counts check', async () => {
            const res = await request(app.getHttpServer())
                .put(
                    `/sets/${getSetSetupData()[0]._id}/task/${
                        getSetSetupData()[0].tasks[0]._id
                    }`
                )
                .send({ ...getMockTask(), type: TaskType.DARE })
                .expect(HttpStatus.OK);

            const set = await setModel
                .findById(getSetSetupData()[0]._id)
                .lean();
            expect(set.truthCount).toBe(0);
            expect(set.dareCount).toBe(1);

            const message = set.tasks[0].message;
            expect(message).toEqual(getMockTask().message);

            // Testing class UpdatedCounts
            const counts = new UpdatedCounts(res.body);
            expect(res.body).toMatchObject(counts);
        });

        it('/sets/:id/task (PUT) with Admin changing type for counts check', async () => {
            fakeAuthGuard.setUser(getMockAuthAdmin());
            const res = await request(app.getHttpServer())
                .put(
                    `/sets/${getSetSetupData()[0]._id}/task/${
                        getSetSetupData()[0].tasks[0]._id
                    }`
                )
                .send({ ...getMockTask(), type: TaskType.DARE })
                .expect(HttpStatus.OK);
            const set = await setModel
                .findById(getSetSetupData()[0]._id)
                .lean();
            expect(set.truthCount).toBe(0);
            expect(set.dareCount).toBe(1);

            const message = set.tasks[0].message;
            expect(message).toEqual(getMockTask().message);

            // Testing class UpdatedCounts
            const counts = new UpdatedCounts(res.body);
            expect(res.body).toMatchObject(counts);
        });

        // Omitting dto tests since they duplicate with task POST tests

        // Negative test
        it('/sets/:id/task (PUT) with wrong set id', async () => {
            await request(app.getHttpServer())
                .put(
                    `/sets/${getWrongId()}/task/${
                        getSetSetupData()[0].tasks[0]._id
                    }`
                )
                .send(getMockTask())
                .expect(HttpStatus.NOT_FOUND);
        });

        // Negative test
        it('/sets/:id/task (PUT) with wrong task id', async () => {
            await request(app.getHttpServer())
                .put(`/sets/${getSetSetupData()[0]._id}/task/${getWrongId()}`)
                .send(getMockTask())
                .expect(HttpStatus.NOT_FOUND);
        });

        // Negative test
        it('/sets/:id/task (PUT) with wrong user', async () => {
            fakeAuthGuard.setUser('');
            await request(app.getHttpServer())
                .put(
                    `/sets/${getSetSetupData()[0]._id}/task/${
                        getSetSetupData()[0].tasks[0]._id
                    }`
                )
                .send(getMockTask())
                .expect(HttpStatus.NOT_FOUND);
        });
    });

    describe('Task DELETE', () => {
        it('/sets/:id/task (DELETE) with user', async () => {
            await request(app.getHttpServer())
                .delete(
                    `/sets/${getSetSetupData()[0]._id}/task/${
                        getSetSetupData()[0].tasks[0]._id
                    }`
                )
                .expect(HttpStatus.NO_CONTENT);
            const set = await setModel.findById(getSetSetupData()[0]._id);
            expect(set.tasks[0].status).toBe(Status.DELETED);
            expect(set.truthCount).toBe(0);
            expect(set.dareCount).toBe(0);
        });

        it('/sets/:id/task (DELETE) with admin', async () => {
            fakeAuthGuard.setUser(getMockAuthAdmin());
            await request(app.getHttpServer())
                .delete(
                    `/sets/${getSetSetupData()[0]._id}/task/${
                        getSetSetupData()[0].tasks[0]._id
                    }`
                )
                .expect(HttpStatus.NO_CONTENT);
            const set = await setModel.findById(getSetSetupData()[0]._id);
            expect(set.tasks[0].status).toBe(Status.DELETED);
            expect(set.truthCount).toBe(0);
            expect(set.dareCount).toBe(0);
        });

        it('/sets/:id/task (DELETE) hard with admin', async () => {
            fakeAuthGuard.setUser(getMockAuthAdmin());
            await request(app.getHttpServer())
                .delete(
                    `/sets/${getSetSetupData()[0]._id}/task/${
                        getSetSetupData()[0].tasks[0]._id
                    }?type=hard`
                )
                .expect(HttpStatus.NO_CONTENT);
            const set = await setModel.findById(getSetSetupData()[0]._id);
            expect(set.tasks.length).toBe(0);
            expect(set.truthCount).toBe(0);
            expect(set.dareCount).toBe(0);
        });

        // Negative test
        it('/sets/:id/task (DELETE) hard with user', async () => {
            await request(app.getHttpServer())
                .delete(
                    `/sets/${getSetSetupData()[0]._id}/task/${
                        getSetSetupData()[0].tasks[0]._id
                    }?type=hard`
                )
                .expect(HttpStatus.FORBIDDEN);
        });

        // Negative test
        it('/sets/:id/task (DELETE) hard, with admin with wrong setId', async () => {
            fakeAuthGuard.setUser(getMockAuthAdmin());
            await request(app.getHttpServer())
                .delete(
                    `/sets/${getWrongId()}/task/${
                        getSetSetupData()[0].tasks[0]._id
                    }?type=hard`
                )
                .expect(HttpStatus.NOT_FOUND);
        });

        // Negative test
        it('/sets/:id/task (DELETE) hard, with admin with wrong taskId', async () => {
            fakeAuthGuard.setUser(getMockAuthAdmin());
            await request(app.getHttpServer())
                .delete(
                    `/sets/${
                        getSetSetupData()[0]._id
                    }/task/${getWrongId()}?type=hard`
                )
                .expect(HttpStatus.NOT_FOUND);
            const set = await setModel.findById(getSetSetupData()[0]._id);
            expect(set.tasks.length).toBe(1);
        });

        // Negative task
        it('/sets/:id/task (DELETE) with wrong set id', async () => {
            await request(app.getHttpServer())
                .delete(
                    `/sets/${getWrongId()}/task/${
                        getSetSetupData()[0].tasks[0]._id
                    }`
                )
                .expect(HttpStatus.NOT_FOUND);
        });

        // Negative task
        it('/sets/:id/task (DELETE) with wrong task id', async () => {
            await request(app.getHttpServer())
                .delete(
                    `/sets/${getSetSetupData()[0]._id}/task/${getWrongId()}`
                )
                .expect(HttpStatus.NOT_FOUND);
        });

        // Negative task
        it('/sets/:id/task (DELETE) with wrong user', async () => {
            fakeAuthGuard.setUser('');
            await request(app.getHttpServer())
                .delete(
                    `/sets/${getSetSetupData()[0]._id}/task/${
                        getSetSetupData()[0].tasks[0]._id
                    }`
                )
                .expect(HttpStatus.NOT_FOUND);
        });
    });
});
