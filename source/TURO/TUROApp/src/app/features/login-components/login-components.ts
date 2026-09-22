import { Component, input, signal } from '@angular/core';
import { Input } from '../../shared/components/inputs/input/input';
import { User03Icon, SecurityPasswordFreeIcons } from '@hugeicons/core-free-icons';
import { Button } from '../../shared/components/button/button';
import {form, FormField, required, email, schema, minLength, FormRoot, disabled} from '@angular/forms/signals';

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
        console.log("fields", fields);
        await new Promise<void>((resolve) => {setTimeout(() => resolve(), 5000)})
        console.log("finished");
      },
      onInvalid: () => {this.submitAttempted.set(true)},
    },
  });
}
