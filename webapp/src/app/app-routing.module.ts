import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LaunchComponent } from './launch/launch.component';
import { WaitingRoomComponent } from './waiting-room/waiting-room.component';

const routes: Routes = [
  { path: 'launch.html', component: LaunchComponent },
  { path: '', component: WaitingRoomComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
