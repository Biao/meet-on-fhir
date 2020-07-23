import { Component, OnInit } from '@angular/core';
import * as FHIR from 'fhirclient';

import { environment } from '../../environments/environment';
import { SettingsService } from '../settings.service';

@Component({
  selector: 'app-launch',
  templateUrl: './launch.component.html',
  styleUrls: ['./launch.component.scss']
})
export class LaunchComponent implements OnInit {

  constructor(
    private readonly settingsService: SettingsService) { }

  ngOnInit(): void {
    this.settingsService.getFhirId().subscribe(clientId => {
      FHIR.oauth2.authorize({
        clientId,
        scope: 'openid fhirUser profile launch launch/patient launch/encounter',
      });
    }, (err) => {
      // Easier for local testing.
      if (!environment.production) {
        FHIR.oauth2.authorize({
          clientId: 'test-fhir-id',
          scope: 'openid fhirUser profile launch launch/patient launch/encounter',
        });
      }
    });
  }

}
