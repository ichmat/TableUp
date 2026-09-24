import { Component, inject, input, signal } from '@angular/core';
import { Input } from '../../shared/components/inputs/input/input';
import { User03Icon, SecurityPasswordFreeIcons } from '@hugeicons/core-free-icons';
import { Button } from '../../shared/components/button/button';
import {form, FormField, required, email, schema, minLength, FormRoot, disabled} from '@angular/forms/signals';
import { AuthService } from '../../core/services/auth/auth.service';
import { Router } from '@angular/router';

interface LoginData {
  login: string;
  password: string;
}

@Component({
  imports: [Input, Button, FormField, FormRoot],
  selector: 'app-login-components',
  templateUrl: './login-components.html',
})

export class LoginComponents {
  private router = inject(Router);
  private authService = inject(AuthService);

  userIcon = User03Icon;
  passwordIcon = SecurityPasswordFreeIcons;
  submitAttempted = signal<boolean>(false);

  loginModel = signal<LoginData>({
    login: '',
    password: '',
  });

  loginForm = form(this.loginModel, (schema) => {
    required(schema.login, {
      message: "Login nécessaire pour la connexion"
    });
    required(schema.password, {
      message: "Mot de passe nécessaire pour la connexion"
    });

    minLength(schema.password, 4, {
      message: "Le mot de passe doit contenir au moins 4 caractères",
    });

    disabled(schema, {when: ({state}) => state.submitting()})
  }, {
    submission:{
      action: async (fields) => {
        const { login, password } = fields().value();

        if(await this.authService.attemptLogin(login, password)){
          this.router.navigate(["/"]);
        }
      },
      onInvalid: () => {this.submitAttempted.set(true)},
    },
  });
}
