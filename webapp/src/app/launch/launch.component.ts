import { Component, OnInit } from '@angular/core';
import * as FHIR from 'fhirclient';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-launch',
  templateUrl: './launch.component.html',
  styleUrls: ['./launch.component.scss']
})
export class LaunchComponent implements OnInit {

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.http.get('/settings').subscribe((res) => {
      const clientId = res['fhirClientId'] ? res['fhirClientId'] : 'fakeId';
      FHIR.oauth2.authorize({
        clientId,
        scope: 'openid fhirUser profile launch launch/patient launch/encounter',
      });
    });
  }

}
