import type { NavigatorScreenParams } from '@react-navigation/native';

export type HomeStackParamList = {
  Home: undefined;
  Profile: undefined;
  EditProfile: undefined;
  LanguageSettings: undefined;
  ManagePortfolio: undefined;
};

export type CustomerRequestsStackParamList = {
  CustomerRequests: undefined;
  CustomerRequestDetail: { requestId: number };
  PublicProfile: { requestId: number; userId: number };
};

export type NewRequestStackParamList = {
  CustomerCreateRequest: undefined;
  CustomerRequestDetail: { requestId: number };
  PublicProfile: { requestId: number; userId: number };
};

export type TechnicianStackParamList = {
  TechnicianRequests: undefined;
  TechnicianRequestDetail: { requestId: number };
  PublicProfile: { requestId: number; userId: number };
};

export type AdminStackParamList = {
  AdminHome: undefined;
  AdminInvoices: undefined;
};

/** Bottom tabs (authenticated shell). */
export type MainTabParamList = {
  HomeTab: undefined;
  CustomerRequestsTab: NavigatorScreenParams<CustomerRequestsStackParamList> | undefined;
  NewRequestTab: NavigatorScreenParams<NewRequestStackParamList> | undefined;
  TechnicianTab: NavigatorScreenParams<TechnicianStackParamList> | undefined;
  AdminTab: NavigatorScreenParams<AdminStackParamList> | undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
};
