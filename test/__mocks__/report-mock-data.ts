import { ReportKind } from './../../src/report/enums/report-kind.enum';
import { ReportStatus } from './../../src/report/enums/report-status.enum';
export const getMockReports = () => [
    {
        _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        set: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        kind: ReportKind.SET_REPORT,
        task: undefined,
        createdBy: undefined,
        status: ReportStatus.NEW,
        description: 'New report 01',
        reviewedby: undefined,
        reviewerNote: undefined
    },
    {
        _id: 'aaaaaaaaaaaaaaaaaaaaaaab',
        set: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        kind: ReportKind.TASK_REPORT,
        task: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        createdBy: undefined,
        status: ReportStatus.APPROVED,
        description: 'New report 02',
        reviewedby: '61bb7c9883fdff2f24bf779d',
        reviewerNote: 'Very valid'
    },
    {
        _id: 'aaaaaaaaaaaaaaaaaaaaaaac',
        set: 'aaaaaaaaaaaaaaaaaaaaaaab',
        kind: ReportKind.SET_REPORT,
        task: undefined,
        createdBy: undefined,
        status: ReportStatus.DECLINED,
        description: 'New report 03',
        reviewedby: '61bb7c9883fdff2f24bf779d',
        reviewerNote: 'Please report Branchverse instead'
    }
];
