import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { render} from 'ejs'
import { readFile as _readFile} from 'fs';
import { promisify } from 'util';

const readFile = promisify(_readFile);

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  public sendMail(recipient: string, subject: string, message:string): void {
    this.mailerService
    .sendMail({
        to: recipient,
        from: 'noreply@lapdanceforfood.com',
        subject: subject,
        html: message,
      })
      .then(() => {})
      .catch(() => {});
  }
  
  async  mailTest(recipient: string){
    const tmpl =   await readFile(__dirname + '/templates/test.ejs', 'utf-8')
    const message = render(tmpl, { 
        // Data to be sent to template engine.
        code: 'cf1a3f828287',
        username: 'john doe',
     });
    this.sendMail(recipient, "testing", message)
  }
}