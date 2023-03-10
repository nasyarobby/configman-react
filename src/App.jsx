import { useEffect, useState } from 'react'
import { CiWarning } from "react-icons/ci";
import useSWR from 'swr'
import Ajv from "ajv";
import { Box, Button, Center, Container, FormControl, FormLabel, Grid, GridItem, Input, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, Select, Spinner, Switch, Tab, TabList, TabPanel, TabPanels, Tabs, Text, Textarea } from '@chakra-ui/react'
import axios from 'axios';

function Control(props) {
  if (props.type === "boolean") {
    return <FormControl display='flex' alignItems='center'>
      <Switch value={!!props.value} isChecked={props.value} onChange={e => {
        console.log(e.target.checked)
        props.updateConfigKey(props.configKey, e.target.checked)
      }} />
    </FormControl>
  }

  if (props.hasOwnProperty('enum')) {
    return <Select placeholder='Select option' onChange={e => {
      props.updateConfigKey(props.configKey, props.type === "number" ? Number(e.target.value) : e.target.value)
    }}
      value={props.value}
    >
      {
        props.enum.map(item => {
          return <option value={item}>{item}</option>
        })
      }
    </Select>
  }

  if (props.type === "number") {
    return <NumberInput value={props.value} onChange={(strValue, numValue) => {
      props.updateConfigKey(props.configKey, numValue)
    }}>
      <NumberInputField />
      <NumberInputStepper>
        <NumberIncrementStepper />
        <NumberDecrementStepper />
      </NumberInputStepper>
    </NumberInput>
  }

  if (props.type === "string") {
    return <Input value={props.value} onChange={e => {
      props.updateConfigKey(props.configKey, e.target.value)
    }} />
  }
}

function AppContainer({ savedConfig, savedSchema, mutateSchema }) {
  const schemaKeys = Object.keys(savedSchema.properties);
  const missingSchemaKeys = schemaKeys.filter(k => {
    return savedConfig.hasOwnProperty(k) === false
  })

  //rebuiilding missing keys with their default value 
  const missingKeys = {}
  missingSchemaKeys.forEach(k => {
    if (savedSchema.properties[k].hasOwnProperty('default'))
      missingKeys[k] = savedSchema.properties[k].default;
    else {
      if (savedSchema.properties[k].type === 'number')
        missingKeys[k] = 0;

      if (savedSchema.properties[k].type === 'string')
        missingKeys[k] = "";

      if (savedSchema.properties[k].type === 'boolean')
        missingKeys[k] = false;

      if (savedSchema.properties[k].type === 'array')
        missingKeys[k] = savedSchema.properties[k].items.enum[0];
    }
  })

  const newConfig = {}
  schemaKeys.forEach(k => {
    if (savedConfig.hasOwnProperty(k))
      newConfig[k] = savedConfig[k]
    else if(missingKeys.hasOwnProperty(k))
      newConfig[k] = missingKeys[k]
  });


  const [config, setConfig] = useState(newConfig);
  const ajv = new Ajv();
  const isValid = ajv.validate(savedSchema, config);
  const [schemaInput, setSchemaInput] = useState(JSON.stringify(savedSchema, null, 4));

  useEffect(() => {
    if (savedSchema?.title) {
      document.title = "ConfigManager: " + savedSchema.title
    }
  }, [savedSchema])

  return (
    <>
      <Text as={"h1"} fontSize={"2xl"} fontWeight={"semibold"}>{savedSchema.title}</Text>
      <Text as={"h1"} fontSize={"md"} fontWeight={"light"}>{savedSchema.description}</Text>
      <Tabs>
        <TabList>
          <Tab>Config</Tab>
          <Tab>Source</Tab>
          <Tab>Schema</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            {
              ajv.errors &&
              <Box bg={"red.200"} p="2" my="4" rounded={"lg"}>{JSON.stringify(ajv.errors)}</Box>
            }
            <Grid templateColumns='repeat(2, 1fr)' gap={6}>
              {schemaKeys.map(cKey => {
                const cProps = savedSchema.properties[cKey]
                return (
                  <>
                    <GridItem w='100%' ><Text fontWeight="bold">{cKey}</Text><br />{cProps.description}</GridItem>
                    <GridItem w='100%'><Control {...cProps}
                      value={config[cKey]}
                      configKey={cKey} updateConfigKey={(cKeyArg, newValueArg) => {
                        setConfig(state => {
                          const newState = { ...state };
                          newState[cKeyArg] = newValueArg;
                          return newState;
                        })
                      }}

                    /></GridItem>
                    <GridItem gridColumn="1/-1" borderBottom="1px solid #ccc"></GridItem>
                  </>
                )
              })}

            </Grid>
            <FormControl display='flex' alignItems='center'>
              <Button variant="solid" onClick={async (e) => {
                axios.post('/api/config', config)
              }}>Simpan</Button>
            </FormControl>
          </TabPanel>
          <TabPanel>
            <Textarea h="50vh" value={JSON.stringify(config, null, 2)} />
          </TabPanel>
          <TabPanel>
            <FormControl display='flex' alignItems='center'>
              <Textarea h="50vh" value={schemaInput} onChange={e => setSchemaInput(e.target.value)} />
            </FormControl>
            <FormControl display='flex' alignItems='center'>
              <Button variant="solid" onClick={async (e) => {
                const data = await axios.post('/api/schema', { schema: schemaInput }).then(resp => JSON.parse(resp.data.data.schema))
                mutateSchema(data);
              }}>Simpan</Button>
            </FormControl>

          </TabPanel>
        </TabPanels>
      </Tabs></>
  )
}

function App() {
  const configFetcher = (url) => axios.get(url).then(resp => resp.data.data.config)
  const { data: dataConfig, error: errorConfig, isLoading: isLoadingConfig, mutate: mutateConfig } = useSWR('/api/config', configFetcher)

  const schemaFetcher = (url) => axios.get(url).then(resp => JSON.parse(resp.data.data.schema))
  const { data: dataSchema, error: errorSchema, isLoading: isLoadingSchema, mutate: mutateSchema } = useSWR('/api/schema', schemaFetcher)

  if (isLoadingConfig || isLoadingSchema)
    return <Center h="100vh" display="flex" flexDirection={'column'} gap="2em">
      <Text fontSize="2xl" as="h1" fontWeight="semibold" textShadow="2px 2px #ccc">ConfigManager</Text>
      <Spinner size='xl' />
      <Text>Memuat data...</Text>
    </Center>

  if (errorConfig || errorSchema) {
    return <Center h="100vh">
      <Box display="flex" alignItems="center" flexDirection={'column'} gap="2em" rounded="lg" border="1px solid #ccc" p="4em" boxShadow="2px 2px #ccc">
        <Text fontSize="2xl" as="h1" fontWeight="semibold" textShadow="2px 2px #ccc">ConfigManager</Text>
        <CiWarning size="2em" />
        <Text>Config Load Error: {errorConfig.toString()}</Text>
        <Text>Schema Load Error: {errorSchema.toString()}</Text>
      </Box>
    </Center>
  }

  return <Container maxW='6xl' mt="10">
    {<AppContainer
      savedConfig={dataConfig}
      savedSchema={dataSchema}
      mutateConfig={mutateConfig}
      mutateSchema={mutateSchema}
    />}
  </Container>




}

export default App
