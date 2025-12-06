import { Routes } from '@angular/router';
import { Editor } from './editor/editor';
import { DocumentsComponent } from './documents/documents';
import { authGuard } from './guards/auth-guard';
import { loginGuard } from './guards/login-guard';
import { Registration } from './registration/registration';
import { Login } from './login/login';
import { Home } from './home/home';


export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        loadComponent: () => {
            return import('./login/login').then((m) => m.Login)
        }
    },
    {
        path: 'login',
        component: Login,
        canActivate: [loginGuard] 

    },
    {
        path: 'register',
        component: Registration,
        canActivate: [loginGuard] 

    },

    {
        path: 'home',
        component: Home,
        canActivate: [authGuard] 
    },
    { path: '**', redirectTo: 'login' }
];
