import { Component, OnInit, Inject, OnDestroy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import * as FHIR from 'fhirclient';
import { MatSnackBar } from '@angular/material/snack-bar';
import Client from 'fhirclient/lib/Client';
import { fhirclient } from 'fhirclient/lib/types';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { interval, from, throwError, Observable, of, ReplaySubject, BehaviorSubject, Subject } from 'rxjs';
import { switchMap, switchMapTo, catchError, first, mergeMap, tap, map, shareReplay, takeUntil } from 'rxjs/operators';
import { MatSelectChange } from '@angular/material/select';
import { Router } from '@angular/router';
import { format } from 'url';
import { SettingsService } from '../settings.service';

@Component({
  selector: 'app-waiting-room',
  templateUrl: './waiting-room.component.html',
  styleUrls: ['./waiting-room.component.scss']
})
export class WaitingRoomComponent implements OnInit, OnDestroy {

  showWaitingRoom = false;
  showConsent = false;
  locale: string;
  showChat: Observable<boolean>;
  practionerName = new ReplaySubject<string>(1);
  patientName = new ReplaySubject<string>(1);
  startTime = new ReplaySubject<string>(1);
  duration = new ReplaySubject<number>(1);
  patientCanJoin = new BehaviorSubject<boolean>(false);

  private client: Client;
  private readonly destory = new Subject();
  private meetUrl: string;
  private encounterDetails: Observable<fhirclient.FHIR.Encounter>;

  constructor(
    private snackBar: MatSnackBar,
    private http: HttpClient,
    private readonly settingsService: SettingsService,
    @Inject(DOCUMENT) private document: Document) {
    this.locale = this.document.location.href.indexOf('/es') !== -1 ? 'es' : 'en';
    this.showChat = this.settingsService.getUiConfig().pipe(map(config => config['showChat']));
  }

  consentClicked(): void {
    this.showWaitingRoom = true;
    this.showConsent = false;
    console.log(this.client.encounter.id);
    this.showChat.subscribe();
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
          this.patientCanJoin.next(true);
          window.clearInterval(timerId);
          this.meetUrl = data['url'] + `?hl=${this.locale}`;
          return;
        }
      }, (error) => { this.showError('An unexpected error occurred in the application'); });
    }, 5000);
  }

  joinMeet(): void {
    window.location.replace(this.meetUrl);
  }

  ngOnDestroy(): void {
    this.destory.next();
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

      console.log(client);

      this.encounterDetails = from(client.encounter.read()).pipe(
        shareReplay(1),
      );

      this.encounterDetails.pipe(
        map(encounter => {
          return encounter?.period?.start;
        }),
      ).subscribe(this.startTime);

      this.encounterDetails.pipe(
        map(encounter => {
          const startTime = new Date(encounter?.period?.start);
          const endTime = new Date(encounter?.period?.end);
          return (endTime.getTime() - startTime.getTime()) / 60000;
        }),
      ).subscribe(this.duration);


      if (userResourceType) {
        // Patient needs to see the consent screen, provider bypasses it.
        if (userResourceType === 'patient') {
          this.showConsent = true;
          this.showWaitingRoom = false;
          // Populate the practioner name.
          this.encounterDetails.pipe(
            map(encounter => {
              return encounter?.participant[0]?.individual?.reference;
            }),
            switchMap(practitionerPath => {
              return from(client.request(practitionerPath));
            }),
            map(res => {
              return `${res?.name[0].prefix} ${res?.name[0].family}`;
            }),
            takeUntil(this.destory),
          ).subscribe(this.practionerName);
          // Populate the patient name.
          from(client.request(`${client.getFhirUser()}`)).pipe(
            map(res => {
              return `${res?.name[0].prefix} ${res?.name[0].family}`;
            }),
            takeUntil(this.destory),
          ).subscribe(this.patientName);
        } else {
          this.showConsent = false;
          this.showWaitingRoom = true;
          // Populate the practioner name.
          from(client.request(`${client.getFhirUser()}`)).pipe(
            map(res => {
              return `${res?.name[0].prefix} ${res?.name[0].family}`;
            }),
            takeUntil(this.destory),
          ).subscribe(this.practionerName);

          // Populate the patient name.
          from(client.patient.read()).pipe(
            map(patient => {
              return `${patient?.name[0].prefix} ${patient?.name[0].family}`;
            }),
            takeUntil(this.destory),
          ).subscribe(this.patientName);
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
