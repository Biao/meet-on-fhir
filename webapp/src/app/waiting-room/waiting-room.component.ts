import { Component, OnInit, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import * as FHIR from 'fhirclient';
import { MatSnackBar } from '@angular/material/snack-bar';
import Client from 'fhirclient/lib/Client';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { interval } from 'rxjs';
import { switchMap, switchMapTo, catchError, first, mergeMap } from 'rxjs/operators';
import { MatSelectChange } from '@angular/material/select';
import { Router } from '@angular/router';

@Component({
  selector: 'app-waiting-room',
  templateUrl: './waiting-room.component.html',
  styleUrls: ['./waiting-room.component.scss']
})
export class WaitingRoomComponent implements OnInit {

  showWaitingRoom = false;
  showConsent = false;
  locale: string;

  private client: Client;

  constructor(
    private snackBar: MatSnackBar,
    private http: HttpClient,
    @Inject(DOCUMENT) private document: Document) {
    this.locale = this.document.location.href.indexOf('/es') !== -1 ? 'es' : 'en';
  }

  consentClicked(): void {
    this.showWaitingRoom = true;
    this.showConsent = false;
    console.log(this.client.encounter.id);
    this.waitForJoin(this.client.encounter.id);
  }

  updateLocale(change: MatSelectChange): void {
    // Angular i18n requires a complete reload. Each locale is packed in a separate app.
    if (change.value === 'en') {
      this.document.location.href = '/en-US';
    } else if (change.value === 'es') {
      this.document.location.href = '/es';
    }
  }

  private showError(message: string): void {
    this.snackBar.open(message);
  }

  private createOrEnterMeeting(encounterId: string): void {
    const data = new URLSearchParams();
    data.set('encounterId', encounterId);
    const options = {
      headers: new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
    };
    this.http.post('/hangouts', data.toString(), options).subscribe((res) => {
      if (res['url']) {
        window.location.replace(res['url']);
      }
    }, (error) => { this.showError('An unexpected error occurred in the application'); });
  }

  private waitForJoin(encounterId: string): void {
    const timerId = window.setInterval(() => {
      this.http.get('/hangouts/' + encounterId).subscribe(data => {
        if (data['url']) {
          window.clearInterval(timerId);
          window.location.replace(data['url'] + `?hl=${this.locale}`);
          return;
        }
      }, (error) => { this.showError('An unexpected error occurred in the application'); });
    }, 5000);
  }

  ngOnInit(): void {
    FHIR.oauth2.ready().then((client: Client) => {
      this.client = client;
      if (!client.encounter || !client.encounter.id) {
        this.showError('No encounter was selected');
        return;
      }

      let userResourceType;

      // Older FHIR server that doesn't support id_token and therefore the fhirUser property.
      if (!client.user || !client.user.resourceType) {
        if (client.state.tokenResponse.fallback_user) {
          userResourceType = client.state.tokenResponse.fallback_user.split('/')[0].toLowerCase();
        }
      } else {
        userResourceType = client.user.resourceType.toLowerCase();
      }

      if (userResourceType) {
        // Patient needs to see the consent screen, provider bypasses it.
        if (userResourceType === 'patient') {
          this.showConsent = true;
          this.showWaitingRoom = false;
        } else {
          this.showConsent = false;
          this.showWaitingRoom = true;
          console.log(this.client.encounter.id);
          this.createOrEnterMeeting(client.encounter.id);
        }
      } else {
        this.showError('FHIR Server too old or misconfigured');
      }
    }).catch(error => {
      this.showError('An error occurred while communicating with the EHR system');
    });
  }

}
