import React from 'react'
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom'
import {ClippingCap} from './ClippingCap'


const App = () => {
  return (
    <Router>
      <Switch>
        <Route exact path="/">
					<ClippingCap/>
        </Route>
      </Switch>
    </Router>
  );
};

export default App;
